const bcrypt = require('bcrypt');
const db = require('../config/db');
const CompanyModel = require('../models/company.model');
const AccountModel = require('../models/account.model');
const { coa_data } = require('../../seed_coa');

const COMPANY_ROLES = [
  'Company Admin',
  'Accountant',
  'Manager',
  'Inventory Manager',
  'Purchasing Agent',
  'Viewer',
];

async function assertCompanyAdmin(req, companyId) {
  const superRoles = ['Super Admin', 'Admin', 'Owner', 'CEO'];
  if (superRoles.includes(req.user.role)) return;

  const membership = await db('company_users')
    .where({ company_id: companyId, user_id: req.user.id })
    .first();

  const allowedCompanyRoles = ['Company Admin', 'Admin', 'Owner', 'CEO'];

  if (!membership || !allowedCompanyRoles.includes(membership.role)) {
    const err = new Error('Company Admin access required');
    err.status = 403;
    throw err;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
  };
}

exports.getOverview = async (req, res) => {
  try {
    const companyId = parseInt(req.query.companyId || req.companyId, 10);
    if (!companyId) return res.status(400).json({ message: 'companyId is required' });
    await assertCompanyAdmin(req, companyId);

    const [members, companies] = await Promise.all([
      db('company_users as cu')
        .join('users as u', 'u.id', 'cu.user_id')
        .where('cu.company_id', companyId)
        .select('u.id', 'u.name', 'u.email', 'u.role as global_role', 'u.created_at', 'cu.role as company_role')
        .orderBy('u.name', 'asc'),
      req.user.role === 'Super Admin'
        ? db('companies as c')
            .leftJoin('company_users as cu', 'cu.company_id', 'c.id')
            .select('c.id', 'c.name', 'c.owner_id', 'c.created_at')
            .count('cu.user_id as member_count')
            .groupBy('c.id')
            .orderBy('c.created_at', 'desc')
        : db('companies as c')
            .join('company_users as cu', 'cu.company_id', 'c.id')
            .where('cu.user_id', req.user.id)
            .select('c.id', 'c.name', 'c.owner_id', 'c.created_at', 'cu.role as user_role')
            .orderBy('c.created_at', 'desc'),
    ]);

    res.json({ roles: COMPANY_ROLES, members, companies });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Company name is required' });

    const company = await db.transaction(async (trx) => {
      const created = await CompanyModel.create({ name: String(name).trim(), ownerId: req.user.id }, trx);
      await CompanyModel.addUser(created.id, req.user.id, 'Company Admin', trx);
      await AccountModel.seedCoa(created.id, coa_data, trx);
      return created;
    });

    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Company name is required' });

    const [company] = await db('companies')
      .where({ id: companyId })
      .update({ name, updated_at: db.fn.now() })
      .returning('*');

    res.json(company);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    const role = req.body.role;
    const password = String(req.body.password || '').trim();

    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!COMPANY_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const user = await db.transaction(async (trx) => {
      let found = await trx('users').whereRaw('LOWER(TRIM(email)) = ?', [email]).first();

      if (!found) {
        const hashed = await bcrypt.hash(password || 'ChangeMe123!', 10);
        [found] = await trx('users')
          .insert({
            name: name || email.split('@')[0],
            email,
            password: hashed,
            role,
          })
          .returning(['id', 'name', 'email', 'role', 'created_at']);
      }

      await trx('company_users')
        .insert({ company_id: companyId, user_id: found.id, role })
        .onConflict(['company_id', 'user_id'])
        .merge({ role });

      let mappedRoleName = role;
      if (role === 'Company Admin') mappedRoleName = 'Admin';
      if (role === 'Super Admin') mappedRoleName = 'Admin';
      const roleRecord = await trx('roles').where('name', mappedRoleName).first();
      
      if (roleRecord) {
        // Clear old roles for this company first
        await trx('user_roles').where({ company_id: companyId, user_id: found.id }).del();
        
        await trx('user_roles')
          .insert({ company_id: companyId, user_id: found.id, role_id: roleRecord.id })
          .onConflict(['user_id', 'company_id', 'role_id']).ignore();
      }

      return found;
    });

    res.status(201).json({ user: publicUser(user), company_role: role });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const userId = parseInt(req.params.userId, 10);
    const { role } = req.body;

    await assertCompanyAdmin(req, companyId);
    if (!COMPANY_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const [membership] = await db('company_users')
      .where({ company_id: companyId, user_id: userId })
      .update({ role })
      .returning('*');

    let mappedRoleName = role;
    if (role === 'Company Admin') mappedRoleName = 'Admin';
    if (role === 'Super Admin') mappedRoleName = 'Admin';
    const roleRecord = await db('roles').where('name', mappedRoleName).first();

    if (roleRecord) {
      await db('user_roles').where({ company_id: companyId, user_id: userId }).del();
      await db('user_roles')
        .insert({ company_id: companyId, user_id: userId, role_id: roleRecord.id })
        .onConflict(['user_id', 'company_id', 'role_id']).ignore();
    }

    if (!membership) return res.status(404).json({ message: 'Member not found' });
    res.json(membership);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const userId = parseInt(req.params.userId, 10);
    await assertCompanyAdmin(req, companyId);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot remove your own access.' });
    }

    const deleted = await db('company_users')
      .where({ company_id: companyId, user_id: userId })
      .del();
      
    await db('user_roles')
      .where({ company_id: companyId, user_id: userId })
      .del();

    if (!deleted) return res.status(404).json({ message: 'Member not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};
