const db = require('../config/db');
const AuthProviderFactory = require('../providers/auth/AuthProviderFactory');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthIdentityService {
  /**
   * Helper to write audit log entry safely (outside main rollback)
   */
  static async logAudit({ companyId, userId, provider = 'GOOGLE', eventType, success, failureCode, email, ip, userAgent }) {
    try {
      await db('authentication_audit_logs').insert({
        company_id: companyId || null,
        user_id: userId || null,
        provider,
        event_type: eventType,
        success: !!success,
        failure_code: failureCode || null,
        email: email || null,
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'Unknown',
        created_at: db.fn.now()
      });
    } catch (err) {
      console.error('[AUDIT_LOG_ERROR]', err);
    }
  }

  /**
   * Main Google Authentication & Workspace Authorization logic
   */
  static async loginWithGoogle({ credential, emailHint, companySlug, ip, userAgent }) {
    const providerInstance = AuthProviderFactory.getProvider('GOOGLE');
    const profile = await providerInstance.verifyIdentity(credential);

    // 1. Validate Email Hint if supplied
    if (emailHint && typeof emailHint === 'string' && emailHint.trim()) {
      const normalizedHint = emailHint.trim().toLowerCase();
      if (normalizedHint !== profile.email) {
        await this.logAudit({
          email: profile.email,
          eventType: 'GOOGLE_LOGIN_FAILED',
          success: false,
          failureCode: 'GOOGLE_EMAIL_MISMATCH',
          ip, userAgent
        });
        const err = new Error('Please sign in using the same Google account as the entered email');
        err.code = 'GOOGLE_EMAIL_MISMATCH';
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. Primary Lookup: Find existing linked user identity by provider & sub
    let identity = await db('user_auth_identities')
      .where({ provider: 'GOOGLE', provider_subject: profile.subject })
      .first();

    let user = null;
    if (identity) {
      user = await db('users').where({ id: identity.user_id }).first();
    } else {
      // Lookup existing user by verified email
      user = await db('users').where({ email: profile.email }).first();
    }

    // 3. Resolve user's active company memberships
    let userCompanies = [];
    if (user) {
      userCompanies = await db('company_users')
        .join('companies', 'company_users.company_id', 'companies.id')
        .where({ 'company_users.user_id': user.id })
        .select('companies.id', 'companies.name', 'companies.slug', 'company_users.role');
    }

    // If no explicit companySlug provided and user belongs to multiple companies, prompt workspace selector
    if (!companySlug && userCompanies.length > 1) {
      return {
        requireWorkspaceSelection: true,
        userCompanies,
        profile: { email: profile.email, name: profile.name, pictureUrl: profile.pictureUrl }
      };
    }

    // 4. Resolve Target Company
    let targetCompany = null;
    if (companySlug) {
      targetCompany = await db('companies').where({ slug: companySlug }).first()
        || await db('companies').where({ id: parseInt(companySlug) || 0 }).first();
    } else if (userCompanies.length === 1) {
      targetCompany = await db('companies').where({ id: userCompanies[0].id }).first();
    } else {
      // Try to find pending invitation company
      const pendingInv = await db('user_access_invitations')
        .where({ email: profile.email, invitation_status: 'PENDING' })
        .orderBy('created_at', 'desc')
        .first();

      if (pendingInv) {
        targetCompany = await db('companies').where({ id: pendingInv.company_id }).first();
      }
    }

    if (!targetCompany) {
      await this.logAudit({
        userId: user?.id,
        email: profile.email,
        eventType: 'GOOGLE_LOGIN_FAILED',
        success: false,
        failureCode: 'ACCOUNT_NOT_AUTHORIZED',
        ip, userAgent
      });
      const err = new Error('This Google account is not authorized for any active workspace. Please ask your administrator for an invitation.');
      err.code = 'ACCOUNT_NOT_AUTHORIZED';
      err.statusCode = 403;
      throw err;
    }

    // 5. Check Company Authentication Settings & Domain Restrictions
    const authSettings = await db('company_auth_settings').where({ company_id: targetCompany.id }).first();
    if (authSettings && authSettings.google_login_enabled === false) {
      await this.logAudit({
        companyId: targetCompany.id,
        userId: user?.id,
        email: profile.email,
        eventType: 'GOOGLE_LOGIN_FAILED',
        success: false,
        failureCode: 'GOOGLE_LOGIN_DISABLED',
        ip, userAgent
      });
      const err = new Error('Google Single Sign-On is disabled for this company workspace.');
      err.code = 'GOOGLE_LOGIN_DISABLED';
      err.statusCode = 403;
      throw err;
    }

    if (authSettings && Array.isArray(authSettings.allowed_google_domains) && authSettings.allowed_google_domains.length > 0) {
      const allowed = authSettings.allowed_google_domains.map(d => String(d).toLowerCase());
      if (!profile.hostedDomain || !allowed.includes(profile.hostedDomain)) {
        await this.logAudit({
          companyId: targetCompany.id,
          userId: user?.id,
          email: profile.email,
          eventType: 'GOOGLE_LOGIN_FAILED',
          success: false,
          failureCode: 'GOOGLE_DOMAIN_NOT_ALLOWED',
          ip, userAgent
        });
        const err = new Error(`Google login for domain "${profile.hostedDomain || 'gmail.com'}" is not allowed for this workspace.`);
        err.code = 'GOOGLE_DOMAIN_NOT_ALLOWED';
        err.statusCode = 403;
        throw err;
      }
    }

    // 6. Execute Membership / Onboarding Transaction
    return await db.transaction(async (trx) => {
      // Check existing company_users membership
      let membership = user ? await trx('company_users').where({ company_id: targetCompany.id, user_id: user.id }).first() : null;

      if (!membership) {
        // Check Pending Invitation
        const invitation = await trx('user_access_invitations')
          .where({ company_id: targetCompany.id, email: profile.email, invitation_status: 'PENDING' })
          .first();

        if (!invitation) {
          throw Object.assign(new Error('This Google account is not authorized for the selected workspace.'), { code: 'ACCOUNT_NOT_AUTHORIZED', statusCode: 403 });
        }

        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
          await trx('user_access_invitations').where({ id: invitation.id }).update({ invitation_status: 'EXPIRED' });
          throw Object.assign(new Error('Workspace invitation has expired. Please request a new invitation from your administrator.'), { code: 'INVITATION_EXPIRED', statusCode: 403 });
        }

        // Check License Limits
        const subscription = await trx('company_subscriptions').where({ company_id: targetCompany.id }).first();
        const maxLicenses = subscription ? subscription.max_user_licenses : 50;
        const activeUsersCountRes = await trx('company_users').where({ company_id: targetCompany.id }).count('* as cnt').first();
        const activeUsersCount = parseInt(activeUsersCountRes.cnt || 0);

        if (activeUsersCount >= maxLicenses) {
          throw Object.assign(new Error('Workspace license limit exceeded. Contact administrator to upgrade licenses.'), { code: 'LICENSE_LIMIT_EXCEEDED', statusCode: 402 });
        }

        // Create User if new
        if (!user) {
          user = await trx('users').insert({
            name: profile.name || profile.email.split('@')[0],
            email: profile.email,
            password: await bcrypt.hash(Math.random().toString(36), 10),
            role: invitation.role_name || 'Accountant'
          }).returning('*').then(rows => rows[0] || rows);
          if (typeof user === 'number') {
            user = await trx('users').where({ id: user }).first();
          }
        }

        // Add Company Membership
        await trx('company_users').insert({
          company_id: targetCompany.id,
          user_id: user.id,
          role: invitation.role_name || 'Accountant'
        });

        // Mark Invitation ACCEPTED
        await trx('user_access_invitations').where({ id: invitation.id }).update({
          invitation_status: 'ACCEPTED',
          accepted_by_user_id: user.id,
          accepted_at: trx.fn.now()
        });

        membership = { role: invitation.role_name || 'Accountant' };
      }

      // Link Identity if missing
      if (!identity) {
        try {
          const [newId] = await trx('user_auth_identities').insert({
            user_id: user.id,
            provider: 'GOOGLE',
            provider_subject: profile.subject,
            provider_email: profile.email,
            provider_email_verified: true,
            provider_picture_url: profile.pictureUrl,
            last_used_company_id: targetCompany.id
          }).returning('id');
          identity = { id: typeof newId === 'object' ? newId.id : newId };
        } catch (dupErr) {
          // Handle concurrent identity link conflict by reloading
          identity = await trx('user_auth_identities').where({ provider: 'GOOGLE', provider_subject: profile.subject }).first();
        }
      } else {
        await trx('user_auth_identities').where({ id: identity.id }).update({
          last_login_at: trx.fn.now(),
          last_used_company_id: targetCompany.id
        });
      }

      // Create Trusted User Session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7-day session

      const [session] = await trx('user_sessions').insert({
        user_id: user.id,
        company_id: targetCompany.id,
        authentication_method: 'GOOGLE',
        ip_address: ip || '127.0.0.1',
        user_agent: userAgent || 'Unknown',
        is_active: true,
        expires_at: expiresAt
      }).returning('*');

      const sessionId = typeof session === 'object' ? session.id : session;

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, sessionId },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      await this.logAudit({
        companyId: targetCompany.id,
        userId: user.id,
        email: profile.email,
        eventType: 'GOOGLE_LOGIN_SUCCEEDED',
        success: true,
        ip, userAgent
      });

      return {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: targetCompany.id, name: targetCompany.name, slug: targetCompany.slug },
        companyRole: membership.role
      };
    });
  }

  /**
   * Link Google account to existing logged-in user
   */
  static async linkGoogleAccount({ userId, credential, passwordConfirmation }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw new Error('User not found');

    if (user.password && passwordConfirmation) {
      const match = await bcrypt.compare(passwordConfirmation, user.password);
      if (!match) throw new Error('Invalid password confirmation');
    }

    const providerInstance = AuthProviderFactory.getProvider('GOOGLE');
    const profile = await providerInstance.verifyIdentity(credential);

    const existingIdentity = await db('user_auth_identities')
      .where({ provider: 'GOOGLE', provider_subject: profile.subject })
      .first();

    if (existingIdentity && existingIdentity.user_id !== userId) {
      throw new Error('This Google account is already linked to another SARFIS account.');
    }

    if (!existingIdentity) {
      await db('user_auth_identities').insert({
        user_id: userId,
        provider: 'GOOGLE',
        provider_subject: profile.subject,
        provider_email: profile.email,
        provider_email_verified: true,
        provider_picture_url: profile.pictureUrl,
        linked_by_user_id: userId
      });
    }

    return { message: 'Google account linked successfully' };
  }

  /**
   * Unlink Google account for logged-in user
   */
  static async unlinkGoogleAccount({ userId }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw new Error('User not found');

    if (!user.password) {
      throw new Error('Cannot unlink Google authentication as it is your only login method. Please set a password first.');
    }

    await db('user_auth_identities').where({ user_id: userId, provider: 'GOOGLE' }).del();
    return { message: 'Google account unlinked successfully' };
  }
}

module.exports = AuthIdentityService;
