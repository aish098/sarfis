const UserModel = require('../models/user.model');
const CompanyModel = require('../models/company.model');
const AccountModel = require('../models/account.model');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { coa_data } = require('../../seed_coa');

class AuthService {
  /**
   * Orchestrates user registration, workspace creation, and COA seeding.
   */
  static async registerUser({ name, email, password, role, ip, device }) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !password) {
      throw new Error('Email and password are required');
    }

    const allowedRoles = ['Company Admin', 'Accountant', 'Viewer'];
    const validatedRole = role && allowedRoles.includes(role) ? role : 'Company Admin';

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new Error('User already exists');
    }

    return await db.transaction(async (trx) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await UserModel.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: validatedRole
      }, trx);
      
      const company = await CompanyModel.create({
        name: `${name || normalizedEmail.split('@')[0]}'s Workspace`,
        ownerId: newUser.id
      }, trx);

      await CompanyModel.addUser(company.id, newUser.id, validatedRole, trx);

      // Seed the company with COA data
      await AccountModel.seedCoa(company.id, coa_data, trx);

      // Create initial active session
      const [session] = await trx('user_sessions')
        .insert({
          user_id: newUser.id,
          company_id: company.id,
          ip_address: ip || '127.0.0.1',
          device: device || 'Unknown',
          is_active: true
        })
        .returning('*');

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role, sessionId: session.id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
      );

      return { user: newUser, token };
    });
  }

  static async loginUser({ email, password, ip, device }) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !password) {
      throw new Error('Email and password are required');
    }

    const user = await UserModel.findByEmail(normalizedEmail);
    if (!user) throw new Error('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    // Create session in DB (without company_id initially)
    const [session] = await db('user_sessions')
      .insert({
        user_id: user.id,
        company_id: null,
        ip_address: ip || '127.0.0.1',
        device: device || 'Unknown',
        is_active: true
      })
      .returning('*');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, sessionId: session.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    return { 
      token, 
      user: { id: user.id, name: user.name, email: user.email, role: user.role } 
    };
  }
}

module.exports = AuthService;
