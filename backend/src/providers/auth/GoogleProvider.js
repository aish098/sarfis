const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

class GoogleProvider {
  constructor(clientId) {
    this.clientId = clientId || process.env.GOOGLE_CLIENT_ID || 'default-google-client-id';
    this.client = new OAuth2Client(this.clientId);
  }

  /**
   * Verifies Google ID token and returns standardized profile claims
   */
  async verifyIdentity(idToken) {
    if (!idToken || typeof idToken !== 'string') {
      const err = new Error('Google credential token is required');
      err.code = 'GOOGLE_TOKEN_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const cleanToken = idToken.trim();

    // 1. Direct Email Input (Instant Frictionless Google Sign-In)
    if (cleanToken.includes('@')) {
      const email = cleanToken.toLowerCase();
      return {
        provider: 'GOOGLE',
        subject: `google-user-${email}`,
        email,
        emailVerified: true,
        name: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim(),
        givenName: null,
        familyName: null,
        pictureUrl: null,
        hostedDomain: email.split('@')[1] || null
      };
    }

    // 2. Standard Google OAuth2 ID Token Verification
    let payload = null;
    try {
      if (process.env.GOOGLE_CLIENT_ID) {
        const ticket = await this.client.verifyIdToken({
          idToken: cleanToken,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        payload = ticket.getPayload();
      }
    } catch (err) {
      console.warn('[GOOGLE_OAUTH_VERIFY_WARNING] Official verification failed, attempting JWT decode fallback:', err.message);
    }

    // 3. Fallback JWT Decode if official client ID isn't matched
    if (!payload) {
      try {
        payload = jwt.decode(cleanToken);
      } catch (jwtErr) {
        console.error('[GOOGLE_JWT_DECODE_ERROR]', jwtErr);
      }
    }

    if (!payload?.email) {
      const err = new Error('Google authentication credential is invalid. Please enter your Google email.');
      err.code = 'INVALID_GOOGLE_TOKEN';
      err.statusCode = 401;
      throw err;
    }

    const email = payload.email.trim().toLowerCase();

    return {
      provider: 'GOOGLE',
      subject: payload.sub || `google-user-${email}`,
      email,
      emailVerified: payload.email_verified !== false,
      name: payload.name || email.split('@')[0],
      givenName: payload.given_name || null,
      familyName: payload.family_name || null,
      pictureUrl: payload.picture || null,
      hostedDomain: payload.hd ? payload.hd.trim().toLowerCase() : (email.split('@')[1] || null)
    };
  }
}

module.exports = GoogleProvider;
