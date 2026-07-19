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
      db('users as u')
        .leftJoin('company_users as cu', function() {
          this.on('cu.user_id', '=', 'u.id').andOn('cu.company_id', '=', db.raw('?', [companyId]));
        })
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

    // Invalidate sessions permissions cache
    await db('user_sessions').where({ user_id: userId }).update({ permissions_cache: null });

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

    // Invalidate sessions permissions cache
    await db('user_sessions').where({ user_id: userId }).update({ permissions_cache: null });

    if (!deleted) return res.status(404).json({ message: 'Member not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.exportCompanyBackup = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const type = req.query.type || 'full';
    const data = {};

    // 1. Fetch metadata
    const company = await db('companies').where({ id: companyId }).first();
    
    // 2. Conditionally aggregate based on type
    if (type === 'full' || type === 'settings') {
      data.company_accounting_settings = await db('company_accounting_settings').where({ company_id: companyId });
      data.settings = await db('settings').where({ scope: 'company', target_id: String(companyId) });
    }

    if (type === 'full' || type === 'accounting') {
      if (!data.company_accounting_settings) {
        data.company_accounting_settings = await db('company_accounting_settings').where({ company_id: companyId });
      }
      data.accounts = await db('accounts').where({ company_id: companyId }).orderBy('code', 'asc');
      data.journal_entries = await db('journal_entries').where({ company_id: companyId }).orderBy('id', 'asc');
      
      const entryIds = data.journal_entries.map(e => e.id);
      data.journal_lines = entryIds.length > 0 
        ? await db('journal_lines').whereIn('entry_id', entryIds).orderBy('id', 'asc') 
        : [];
      data.vouchers = await db('vouchers').where({ company_id: companyId }).orderBy('id', 'asc');
    }

    if (type === 'full' || type === 'inventory') {
      data.products = await db('products').where({ company_id: companyId }).orderBy('id', 'asc');
      
      const productIds = data.products.map(p => p.id);
      data.inventory = productIds.length > 0 
        ? await db('inventory').whereIn('product_id', productIds).orderBy('id', 'asc') 
        : [];
      data.stock_logs = productIds.length > 0 
        ? await db('stock_logs').whereIn('product_id', productIds).orderBy('id', 'asc') 
        : [];
    }

    if (type === 'full') {
      data.clients = await db('clients').where({ company_id: companyId }).orderBy('id', 'asc');
      data.vendors = await db('vendors').where({ company_id: companyId }).orderBy('id', 'asc');
    }

    if (req.query.format === 'xlsx') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();

      const metaSheet = workbook.addWorksheet('Metadata');
      metaSheet.columns = [
        { header: 'Key', key: 'key', width: 25 },
        { header: 'Value', key: 'value', width: 45 }
      ];
      metaSheet.addRow({ key: 'companyId', value: companyId });
      metaSheet.addRow({ key: 'companyName', value: company ? company.name : 'Unknown Workspace' });
      metaSheet.addRow({ key: 'backupType', value: type });
      metaSheet.addRow({ key: 'timestamp', value: new Date().toISOString() });

      for (const [tableName, rows] of Object.entries(data)) {
        const sheetName = tableName.substring(0, 31);
        const sheet = workbook.addWorksheet(sheetName);
        if (rows && rows.length > 0) {
          const headers = Object.keys(rows[0]);
          sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
          for (const row of rows) {
            sheet.addRow(row);
          }
        }
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ACCOUNTELLENCE_${type.toUpperCase()}_Backup_${(company ? company.name : 'Workspace').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);

      const buffer = await workbook.xlsx.writeBuffer();
      return res.send(buffer);
    }

    res.json({
      companyId,
      companyName: company ? company.name : 'Unknown Workspace',
      backupType: type,
      timestamp: new Date().toISOString(),
      data
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.restoreCompanyBackup = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const { backupType, data } = req.body;
    if (!data) return res.status(400).json({ message: 'Invalid backup payload: missing data object' });

    await db.transaction(async (trx) => {
      // 1. Delete existing records for the tables present in the backup data
      if (data.company_accounting_settings) {
        await trx('company_accounting_settings').where('company_id', companyId).del();
      }
      if (data.settings) {
        await trx('settings').where({ scope: 'company', target_id: String(companyId) }).del();
      }
      if (data.vouchers) {
        await trx('vouchers').where('company_id', companyId).del();
      }
      if (data.journal_lines) {
        const entryIds = await trx('journal_entries').where('company_id', companyId).select('id');
        const ids = entryIds.map(e => e.id);
        if (ids.length > 0) {
          await trx('journal_lines').whereIn('entry_id', ids).del();
        }
      }
      if (data.journal_entries) {
        await trx('journal_entries').where('company_id', companyId).del();
      }
      if (data.stock_logs) {
        const prodIds = await trx('products').where('company_id', companyId).select('id');
        const ids = prodIds.map(p => p.id);
        if (ids.length > 0) {
          await trx('stock_logs').whereIn('product_id', ids).del();
        }
      }
      if (data.inventory) {
        const prodIds = await trx('products').where('company_id', companyId).select('id');
        const ids = prodIds.map(p => p.id);
        if (ids.length > 0) {
          await trx('inventory').whereIn('product_id', ids).del();
        }
      }
      if (data.products) {
        await trx('products').where('company_id', companyId).del();
      }
      if (data.clients) {
        await trx('clients').where('company_id', companyId).del();
      }
      if (data.vendors) {
        await trx('vendors').where('company_id', companyId).del();
      }
      if (data.accounts) {
        await trx('accounts').where('company_id', companyId).del();
      }

      // 2. Helper to insert and reset primary key sequence
      const insertTable = async (tableName, rows) => {
        if (!rows || rows.length === 0) return;
        
        const mappedRows = rows.map(row => {
          const mapped = { ...row };
          if (mapped.hasOwnProperty('company_id')) {
            mapped.company_id = companyId;
          }
          if (tableName === 'settings' && mapped.scope === 'company') {
            mapped.target_id = String(companyId);
          }
          return mapped;
        });

        await trx(tableName).insert(mappedRows);
        
        const hasId = rows[0].hasOwnProperty('id');
        if (hasId) {
          const [{ max }] = await trx(tableName).max('id as max');
          if (max) {
            await trx.raw(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${max})`);
          }
        }
      };

      // Order of insertions to satisfy relational foreign keys
      if (data.settings) await insertTable('settings', data.settings);
      if (data.company_accounting_settings) await insertTable('company_accounting_settings', data.company_accounting_settings);
      if (data.accounts) await insertTable('accounts', data.accounts);
      if (data.clients) await insertTable('clients', data.clients);
      if (data.vendors) await insertTable('vendors', data.vendors);
      if (data.products) await insertTable('products', data.products);
      if (data.inventory) await insertTable('inventory', data.inventory);
      if (data.journal_entries) await insertTable('journal_entries', data.journal_entries);
      if (data.journal_lines) await insertTable('journal_lines', data.journal_lines);
      if (data.vouchers) await insertTable('vouchers', data.vouchers);
      if (data.stock_logs) await insertTable('stock_logs', data.stock_logs);
    });

    res.json({ success: true, message: `Successfully restored ${backupType} backup.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.parseExcelBackup = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    if (!req.file) {
      return res.status(400).json({ message: 'No backup file uploaded.' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const backup = {
      companyId: null,
      companyName: '',
      backupType: '',
      timestamp: '',
      data: {}
    };

    const metaSheet = workbook.getWorksheet('Metadata');
    if (metaSheet) {
      metaSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const key = row.getCell(1).value;
          const val = row.getCell(2).value;
          if (key === 'companyId') backup.companyId = parseInt(val, 10);
          else if (key === 'companyName') backup.companyName = String(val);
          else if (key === 'backupType') backup.backupType = String(val);
          else if (key === 'timestamp') backup.timestamp = String(val);
        }
      });
    }

    workbook.eachSheet(sheet => {
      if (sheet.name === 'Metadata') return;

      const tableName = sheet.name;
      const rows = [];
      let headers = [];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          headers = row.values.slice(1);
        } else {
          const item = {};
          const vals = row.values.slice(1);
          headers.forEach((h, idx) => {
            let cellValue = vals[idx];
            if (cellValue && typeof cellValue === 'object') {
              if (cellValue.result !== undefined) cellValue = cellValue.result;
              else if (cellValue.text !== undefined) cellValue = cellValue.text;
            }
            item[h] = cellValue;
          });
          rows.push(item);
        }
      });

      backup.data[tableName] = rows;
    });

    res.json(backup);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.purgeCompanyTransactions = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const { password, companyName } = req.body;
    if (!password || !companyName) {
      return res.status(400).json({ message: 'Password and company name confirmation are required.' });
    }

    // 1. Verify password
    const user = await db('users').where({ id: req.user.id }).first();
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // 2. Verify company name
    const company = await db('companies').where({ id: companyId }).first();
    if (!company || company.name !== companyName.trim()) {
      return res.status(400).json({ message: 'Company name confirmation mismatch.' });
    }

    // 3. Execute purge transactionally
    await db.transaction(async (trx) => {
      await trx('transaction_audit_logs').where('company_id', companyId).del();
      
      const entryIds = await trx('journal_entries').where('company_id', companyId).select('id');
      const ids = entryIds.map(e => e.id);
      if (ids.length > 0) {
        await trx('journal_lines').whereIn('entry_id', ids).del();
      }
      await trx('journal_entries').where('company_id', companyId).del();
      await trx('vouchers').where('company_id', companyId).del();

      const prodIds = await trx('products').where('company_id', companyId).select('id');
      const pids = prodIds.map(p => p.id);
      if (pids.length > 0) {
        await trx('stock_logs').whereIn('product_id', pids).del();
        await trx('inventory').whereIn('product_id', pids).update({ quantity: 0 });
      }

      await trx('clients').where('company_id', companyId).update({ current_balance: 0 });
      await trx('vendors').where('company_id', companyId).update({ current_balance: 0 });
      await trx('accounts').where('company_id', companyId).update({ balance: 0 });

      // 4. Clear payroll transactions
      const runIds = await trx('payroll_runs').where('company_id', companyId).select('id');
      const rids = runIds.map(r => r.id);
      if (rids.length > 0) {
        const lineIds = await trx('payroll_lines').whereIn('payroll_run_id', rids).select('id');
        const lids = lineIds.map(l => l.id);
        if (lids.length > 0) {
          await trx('payroll_line_details').whereIn('payroll_line_id', lids).del();
          await trx('payroll_payments').whereIn('payroll_line_id', lids).del();
          await trx('payroll_adjustments').whereIn('payroll_line_id', lids).del();
          await trx('payroll_payslips').whereIn('payroll_line_id', lids).del();
          await trx('payroll_status_history').whereIn('payroll_line_id', lids).del();
        }
        await trx('payroll_lines').whereIn('payroll_run_id', rids).del();
      }
      await trx('payroll_runs').where('company_id', companyId).del();

      // Log purge to audit trail
      await trx('audit_logs').insert({
        company_id: companyId,
        user_id: req.user.id,
        action: 'PURGE',
        entity_type: 'company',
        entity_id: String(companyId),
        before_state: null,
        after_state: null,
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'Unknown'
      });
    });

    res.json({ success: true, message: 'All transactional ledger logs have been purged. Master tables preserved.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getActiveSessions = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const sessions = await db('user_sessions as us')
      .join('users as u', 'u.id', 'us.user_id')
      .select('us.id', 'u.name', 'u.email', 'us.ip_address', 'us.device', 'us.login_time', 'us.last_activity', 'us.is_active', 'us.user_id')
      .orderBy('us.last_activity', 'desc');

    const mappedSessions = sessions.map(s => ({
      ...s,
      is_current: s.id === req.user.sessionId
    }));

    res.json(mappedSessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.terminateSession = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const sessionId = parseInt(req.params.id, 10);
    await db('user_sessions')
      .where({ id: sessionId, company_id: companyId })
      .update({ is_active: false });

    // Insert an audit log entry for session termination
    await db('audit_logs').insert({
      company_id: companyId,
      user_id: req.user.id,
      action: 'TERMINATE_SESSION',
      entity_type: 'session',
      entity_id: String(sessionId),
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Unknown'
    });

    res.json({ success: true, message: 'Session terminated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.terminateOtherSessions = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const currentSessionId = req.user.sessionId;

    await db('user_sessions')
      .where({ company_id: companyId })
      .andWhere('id', '<>', currentSessionId)
      .update({ is_active: false });

    // Insert an audit log entry for session termination
    await db('audit_logs').insert({
      company_id: companyId,
      user_id: req.user.id,
      action: 'TERMINATE_OTHER_SESSIONS',
      entity_type: 'session',
      entity_id: String(companyId),
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Unknown'
    });

    res.json({ success: true, message: 'All other active sessions terminated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserPermissionDetails = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const userId = parseInt(req.params.userId, 10);
    await assertCompanyAdmin(req, companyId);

    const targetUser = await db('users').where({ id: userId }).first();
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    // 1. Get workspace role
    const member = await db('company_users')
      .where({ company_id: companyId, user_id: userId })
      .first();

    const roleName = member ? member.role : 'Viewer';

    // 2. Load all system permissions
    const allPermissions = await db('permissions').orderBy('code', 'asc');

    // 3. Load role permissions
    let rolePermissionIds = [];
    if (member) {
      let mappedRoleName = member.role;
      if (member.role === 'Company Admin') mappedRoleName = 'Admin';
      const roleRecord = await db('roles').where('name', mappedRoleName).first();
      if (roleRecord) {
        const rp = await db('role_permissions').where({ role_id: roleRecord.id }).select('permission_id');
        rolePermissionIds = rp.map(item => item.permission_id);
      }
    }

    // 4. Load overrides with approval, requester, and reason data (excluding soft-deleted ones)
    const overrides = await db('user_permission_overrides as upo')
      .leftJoin('users as u_app', 'u_app.id', 'upo.approved_by')
      .leftJoin('users as u_req', 'u_req.id', 'upo.requested_by')
      .where({ 'upo.user_id': userId, 'upo.company_id': companyId, 'upo.is_deleted': false })
      .select(
        'upo.*',
        'u_app.name as approved_by_name',
        'u_app.email as approved_by_email',
        'u_req.name as requested_by_name',
        'u_req.email as requested_by_email'
      );

    const now = new Date();
    res.json({
      userId,
      userName: targetUser.name,
      userEmail: targetUser.email,
      role: roleName,
      isSuperAdmin: targetUser.role === 'Super Admin',
      rolePermissionIds,
      allPermissions,
      overrides: overrides.map(o => {
        let status = 'ACTIVE';
        if (o.approval_status === 'PENDING') {
          status = 'PENDING';
        } else if (!o.is_allowed) {
          status = 'REVOKED';
        } else {
          if (o.start_date && now < new Date(o.start_date)) {
            status = 'INACTIVE';
          }
          if (o.end_date) {
            const end = new Date(o.end_date);
            end.setHours(23, 59, 59, 999);
            if (now > end) {
              status = 'EXPIRED';
            }
          }
        }
        return {
          permissionId: o.permission_id,
          isAllowed: o.is_allowed,
          startDate: o.start_date ? o.start_date.toISOString().split('T')[0] : null,
          endDate: o.end_date ? o.end_date.toISOString().split('T')[0] : null,
          reason: o.reason,
          approvedBy: o.approved_by,
          approvedByName: o.approved_by_name,
          approvedByEmail: o.approved_by_email,
          requestedBy: o.requested_by,
          requestedByName: o.requested_by_name,
          requestedByEmail: o.requested_by_email,
          approvalStatus: o.approval_status,
          status
        };
      })
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveUserPermissionOverrides = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const userId = parseInt(req.params.userId, 10);
    await assertCompanyAdmin(req, companyId);

    const targetUser = await db('users').where({ id: userId }).first();
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });
    if (targetUser.role === 'Super Admin') {
      return res.status(400).json({ message: 'Permissions overrides cannot be set for Super Admins.' });
    }

    const { overrides } = req.body; // array of { permissionId, isAllowed, startDate, endDate, isDeleted, reason }
    if (!Array.isArray(overrides)) {
      return res.status(400).json({ message: 'Overrides array is required.' });
    }

    const criticalPerms = [
      'journal.post',
      'voucher.post',
      'settings.manage',
      'user.manage',
      'backup.restore',
      'ledger.purge',
      'period.lock',
      'role.manage',
      'permission.override'
    ];

    await db.transaction(async (trx) => {
      for (const ovr of overrides) {
        const { permissionId, isAllowed, startDate, endDate, isDeleted, reason } = ovr;

        // Fetch permission info for auditing and validation
        const permission = await trx('permissions').where({ id: permissionId }).first();
        const permCode = permission ? permission.code : `ID ${permissionId}`;
        const isCritical = criticalPerms.includes(permCode);

        // 4-Eyes justification check for critical permissions
        if (!isDeleted && isCritical) {
          if (!reason || !reason.trim()) {
            throw new Error(`Justification reason is required to override critical permission '${permCode}'.`);
          }
        }

        // Determine 4-Eyes approval status
        // Critical permissions go to PENDING approval first. Non-critical are APPROVED immediately.
        const targetStatus = isCritical && !isDeleted ? 'PENDING' : 'APPROVED';

        // Check if override already exists (including soft-deleted ones)
        const existing = await trx('user_permission_overrides')
          .where({ user_id: userId, company_id: companyId, permission_id: permissionId })
          .first();

        let overrideId;
        let action = 'CREATED';

        if (existing) {
          action = isDeleted ? 'RESET' : 'UPDATED';
          await trx('user_permission_overrides')
            .where({ id: existing.id })
            .update({
              is_allowed: isDeleted ? existing.is_allowed : isAllowed,
              start_date: isDeleted ? existing.start_date : (startDate ? new Date(startDate) : null),
              end_date: isDeleted ? existing.end_date : (endDate ? new Date(endDate) : null),
              reason: isDeleted ? existing.reason : (reason || null),
              requested_by: isDeleted ? existing.requested_by : req.user.id,
              approved_by: isDeleted ? existing.approved_by : (targetStatus === 'APPROVED' ? req.user.id : null),
              approval_status: targetStatus,
              is_deleted: isDeleted
            });
          overrideId = existing.id;
        } else if (!isDeleted) {
          const [newIdObj] = await trx('user_permission_overrides')
            .insert({
              user_id: userId,
              company_id: companyId,
              permission_id: permissionId,
              is_allowed: isAllowed,
              start_date: startDate ? new Date(startDate) : null,
              end_date: endDate ? new Date(endDate) : null,
              reason: reason || null,
              requested_by: req.user.id,
              approved_by: targetStatus === 'APPROVED' ? req.user.id : null,
              approval_status: targetStatus,
              is_deleted: false
            })
            .returning('id');
          overrideId = typeof newIdObj === 'object' ? newIdObj.id : newIdObj;
        }

        // Log shadow history row if override exists or was created
        if (overrideId) {
          const loadedOverride = await trx('user_permission_overrides').where({ id: overrideId }).first();
          await trx('user_permission_overrides_history').insert({
            override_id: overrideId,
            user_id: userId,
            company_id: companyId,
            permission_id: permissionId,
            is_allowed: loadedOverride.is_allowed,
            start_date: loadedOverride.start_date,
            end_date: loadedOverride.end_date,
            reason: loadedOverride.reason,
            requested_by: loadedOverride.requested_by,
            approved_by: loadedOverride.approved_by,
            approval_status: loadedOverride.approval_status,
            is_deleted: loadedOverride.is_deleted,
            action: action
          });
        }

        // Log to global audit logs
        if (!isDeleted) {
          const stateDesc = isAllowed ? 'GRANTED' : 'REVOKED';
          const datesDesc = (startDate || endDate)
            ? ` (Active: ${startDate || 'Anytime'} to ${endDate || 'Anytime'})`
            : '';
          
          await trx('audit_logs').insert({
            company_id: companyId,
            user_id: req.user.id,
            action: isCritical ? 'CRITICAL_PERMISSION_OVERRIDE_REQUESTED' : 'PERMISSION_OVERRIDE',
            entity_type: 'user',
            entity_id: String(userId),
            before_state: null,
            after_state: JSON.stringify({ permission: permCode, action: stateDesc, dates: datesDesc, reason: reason || 'None', approval: targetStatus }),
            ip_address: req.ip || '127.0.0.1',
            user_agent: req.headers['user-agent'] || 'Unknown'
          });
        } else {
          await trx('audit_logs').insert({
            company_id: companyId,
            user_id: req.user.id,
            action: 'PERMISSION_OVERRIDE_RESET',
            entity_type: 'user',
            entity_id: String(userId),
            before_state: null,
            after_state: JSON.stringify({ permission: permCode, action: 'RESET_TO_ROLE_DEFAULT' }),
            ip_address: req.ip || '127.0.0.1',
            user_agent: req.headers['user-agent'] || 'Unknown'
          });
        }
      }
    });

    // Invalidate sessions permissions cache for this user
    await db('user_sessions').where({ user_id: userId }).update({ permissions_cache: null });

    res.json({ success: true, message: 'User-specific overrides updated successfully.' });
  } catch (err) {
    res.status(400).json({ message: err.message }); // Return 400 for validation failures
  }
};

exports.approveUserPermissionOverride = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const userId = parseInt(req.params.userId, 10);
    const permissionId = parseInt(req.params.permissionId, 10);
    await assertCompanyAdmin(req, companyId);

    const override = await db('user_permission_overrides')
      .where({ user_id: userId, company_id: companyId, permission_id: permissionId, is_deleted: false })
      .first();

    if (!override) {
      return res.status(404).json({ message: 'Active override request not found.' });
    }

    if (override.approval_status === 'APPROVED') {
      return res.status(400).json({ message: 'Override is already approved.' });
    }

    // 4-Eyes Check: Approver cannot be the requester
    if (override.requested_by === req.user.id) {
      return res.status(400).json({
        message: '4-Eyes Policy Violation: You cannot approve your own permission override request.'
      });
    }

    // Update to approved
    await db.transaction(async (trx) => {
      await trx('user_permission_overrides')
        .where({ id: override.id })
        .update({
          approval_status: 'APPROVED',
          approved_by: req.user.id
        });

      // Insert into override history shadow table
      await trx('user_permission_overrides_history').insert({
        override_id: override.id,
        user_id: userId,
        company_id: companyId,
        permission_id: permissionId,
        is_allowed: override.is_allowed,
        start_date: override.start_date,
        end_date: override.end_date,
        reason: override.reason,
        requested_by: override.requested_by,
        approved_by: req.user.id,
        approval_status: 'APPROVED',
        is_deleted: false,
        action: 'APPROVED'
      });

      // Fetch permission info for auditing
      const permission = await trx('permissions').where({ id: permissionId }).first();
      const permCode = permission ? permission.code : `ID ${permissionId}`;

      // Insert to audit_logs
      await trx('audit_logs').insert({
        company_id: companyId,
        user_id: req.user.id, // Approver id
        action: 'PERMISSION_OVERRIDE_APPROVED',
        entity_type: 'user',
        entity_id: String(userId),
        before_state: JSON.stringify({ requested_by: override.requested_by }),
        after_state: JSON.stringify({ permission: permCode, action: 'APPROVED' }),
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'Unknown'
      });
    });

    // Invalidate sessions permissions cache for this user
    await db('user_sessions').where({ user_id: userId }).update({ permissions_cache: null });

    try {
      const NotificationService = require('../services/notification.service');
      const permission = await db('permissions').where({ id: override.permission_id }).first();
      const permCode = permission ? permission.code : 'custom settings';
      const approver = await db('users').where({ id: req.user.id }).first();
      const approverName = approver ? approver.name : 'An administrator';

      await NotificationService.createNotification({
        companyId,
        userId: userId,
        title: 'Permission Override Approved',
        message: `Your override request for permission '${permCode}' has been approved by ${approverName}.`,
        type: 'permission',
        priority: 'HIGH',
        entityType: 'admin',
        entityId: override.id
      });
    } catch (notifErr) {
      console.error('Failed to notify permission override approval:', notifErr);
    }

    res.json({ success: true, message: 'Permission override approved successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPendingApprovals = async (req, res) => {
  const companyId = parseInt(req.params.companyId || req.companyId, 10);
  if (!companyId) return res.status(400).json({ message: 'companyId is required' });

  try {
    const userPerms = req.userPermissions || [];
    const isSuperAdmin = req.user.role === 'Super Admin';
    const canApproveJournals = isSuperAdmin || userPerms.includes('journal.post') || userPerms.includes('journal.approve');
    const canApproveVouchers = isSuperAdmin || userPerms.includes('voucher.post') || userPerms.includes('voucher.approve');

    let pendingVouchers = [];
    if (canApproveVouchers) {
      pendingVouchers = await db('vouchers as v')
        .leftJoin('users as u', 'v.created_by', 'u.id')
        .select('v.*', 'u.name as creator_name')
        .where({ 'v.company_id': companyId, 'v.status': 'PENDING_APPROVAL', 'v.deleted_at': null })
        .orderBy('v.date', 'desc')
        .orderBy('v.created_at', 'desc');
    }

    let pendingJournals = [];
    if (canApproveJournals) {
      pendingJournals = await db('journal_entries as je')
        .leftJoin('users as u', 'je.created_by', 'u.id')
        .leftJoin('journal_lines as jl', 'je.id', 'jl.entry_id')
        .select('je.*', 'u.name as creator_name', db.raw('COALESCE(SUM(jl.debit), 0) as total_amount'))
        .where({ 'je.company_id': companyId, 'je.status': 'PENDING_APPROVAL' })
        .groupBy('je.id', 'u.id', 'u.name')
        .orderBy('je.entry_date', 'desc');
    }

    res.json({
      pendingJournals,
      pendingVouchers,
      canApproveJournals,
      canApproveVouchers
    });
  } catch (err) {
    console.error('getPendingApprovals error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCompanyMembers = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const members = await db('company_users as cu')
      .join('users as u', 'u.id', 'cu.user_id')
      .where('cu.company_id', companyId)
      .select('u.id as user_id', 'u.name', 'u.email', 'cu.role')
      .orderBy('u.name', 'asc');

    res.json(members);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
