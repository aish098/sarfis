const bcrypt = require('bcryptjs');
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
  // Super Admin overrides everything
  if (req.user.role === 'Super Admin' || req.userCompanyRole === 'Super Admin') return;

  const membership = await db('company_users')
    .where({ company_id: companyId, user_id: req.user.id })
    .first();

  const allowedCompanyRoles = ['company_admin', 'Company Admin', 'Admin', 'Owner', 'CEO'];

  if (!membership || !allowedCompanyRoles.includes(membership.role)) {
    const err = new Error('Company Admin access required. Only Company Admins can manage workspace controls.');
    err.status = 403;
    throw err;
  }
}

async function checkLastAdminProtection(companyId, targetUserId) {
  const adminMembers = await db('company_users')
    .where({ company_id: companyId })
    .whereIn('role', ['company_admin', 'Company Admin', 'Admin', 'Owner', 'CEO']);

  const isTargetAdmin = adminMembers.some(m => m.user_id === targetUserId);
  if (isTargetAdmin && adminMembers.length <= 1) {
    const err = new Error('Cannot demote or remove the last Company Admin of the workspace.');
    err.status = 400;
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
        .leftJoin('company_users as cu', function () {
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

exports.getAvailableRoles = async (req, res) => {
  try {
    const roles = [
      { code: 'company_admin', name: 'Company Admin', description: 'Full Corporate Workspace Administrator' },
      { code: 'finance_director', name: 'Finance Director', description: 'Financial Statements, Approvals, & GL Postings' },
      { code: 'hr_manager', name: 'HR Manager', description: 'Employee Master, Payroll Calculation, & Attendance' },
      { code: 'accountant', name: 'Accountant', description: 'Journal Entries, Vouchers, & Subledgers' },
      { code: 'viewer', name: 'Viewer', description: 'Read-Only Workspace Inspector' }
    ];
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    const roleInput = req.body.role || req.body.roleName || 'Viewer';
    const password = String(req.body.password || '').trim();

    if (!email) return res.status(400).json({ message: 'Email is required' });

    let roleCode = 'viewer';
    let roleDisplay = 'Viewer';
    const rLower = roleInput.toLowerCase();
    if (rLower.includes('admin') || rLower.includes('owner')) {
      roleCode = 'company_admin';
      roleDisplay = 'Company Admin';
    } else if (rLower.includes('finance')) {
      roleCode = 'finance_director';
      roleDisplay = 'Finance Director';
    } else if (rLower.includes('hr')) {
      roleCode = 'hr_manager';
      roleDisplay = 'HR Manager';
    } else if (rLower.includes('accountant')) {
      roleCode = 'accountant';
      roleDisplay = 'Accountant';
    }

    const user = await db.transaction(async (trx) => {
      let found = await trx('users').whereRaw('LOWER(TRIM(email)) = ?', [email]).first();

      if (!found) {
        const hashed = await bcrypt.hash(password || 'ChangeMe123!', 10);
        [found] = await trx('users')
          .insert({
            name: name || email.split('@')[0],
            email,
            password: hashed,
            role: roleDisplay,
          })
          .returning(['id', 'name', 'email', 'role', 'created_at']);
      }

      await trx('company_users')
        .insert({ company_id: companyId, user_id: found.id, role: roleDisplay })
        .onConflict(['company_id', 'user_id'])
        .merge({ role: roleDisplay });

      const roleRecord = await trx('roles').whereIn('name', [roleCode, roleDisplay, 'Admin']).first();
      if (roleRecord) {
        await trx('user_roles').where({ company_id: companyId, user_id: found.id }).del();
        await trx('user_roles')
          .insert({ company_id: companyId, user_id: found.id, role_id: roleRecord.id })
          .onConflict(['user_id', 'company_id', 'role_id']).ignore();
      }

      return found;
    });

    res.status(201).json({ user: publicUser(user), company_role: roleDisplay });
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

    let roleCode = 'viewer';
    let roleDisplay = 'Viewer';
    const rLower = String(role || '').toLowerCase();
    if (rLower.includes('admin') || rLower.includes('owner')) {
      roleCode = 'company_admin';
      roleDisplay = 'Company Admin';
    } else if (rLower.includes('finance')) {
      roleCode = 'finance_director';
      roleDisplay = 'Finance Director';
    } else if (rLower.includes('hr')) {
      roleCode = 'hr_manager';
      roleDisplay = 'HR Manager';
    } else if (rLower.includes('accountant')) {
      roleCode = 'accountant';
      roleDisplay = 'Accountant';
    }

    if (roleCode !== 'company_admin') {
      await checkLastAdminProtection(companyId, userId);
    }

    await db.transaction(async (trx) => {
      await trx('company_users')
        .where({ company_id: companyId, user_id: userId })
        .update({ role: roleDisplay });

      const roleRecord = await trx('roles').whereIn('name', [roleCode, roleDisplay, 'Admin']).first();
      if (roleRecord) {
        await trx('user_roles').where({ company_id: companyId, user_id: userId }).del();
        await trx('user_roles')
          .insert({ company_id: companyId, user_id: userId, role_id: roleRecord.id })
          .onConflict(['user_id', 'company_id', 'role_id']).ignore();
      }

      await trx('user_sessions').where({ user_id: userId }).update({ permissions_cache: null });
    });

    res.json({ success: true, company_id: companyId, user_id: userId, role: roleDisplay });
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

    await checkLastAdminProtection(companyId, userId);

    await db.transaction(async (trx) => {
      await trx('company_users')
        .where({ company_id: companyId, user_id: userId })
        .del();

      await trx('user_roles')
        .where({ company_id: companyId, user_id: userId })
        .del();

      await trx('user_sessions').where({ user_id: userId }).update({ permissions_cache: null });
    });

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
      data.company_accounting_settings = await db('company_accounting_settings').where({ company_id: companyId }).catch(() => []);
      data.company_tax_settings = await db('company_tax_settings').where({ company_id: companyId }).catch(() => []);
      data.company_auth_settings = await db('company_auth_settings').where({ company_id: companyId }).catch(() => []);
      data.settings = await db('settings').where({ scope: 'company', target_id: String(companyId) }).catch(() => []);
      data.accounting_periods = await db('accounting_periods').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.fiscal_years = await db('fiscal_years').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
    }

    if (type === 'full' || type === 'accounting') {
      if (!data.company_accounting_settings) {
        data.company_accounting_settings = await db('company_accounting_settings').where({ company_id: companyId }).catch(() => []);
      }
      data.accounts = await db('accounts')
        .where(function() { this.where('company_id', companyId).orWhereNull('company_id'); })
        .orderBy('code', 'asc')
        .catch(() => []);
      data.clients = await db('clients')
        .where(function() { this.where('company_id', companyId).orWhereNull('company_id'); })
        .orderBy('id', 'asc')
        .catch(() => []);
      data.vendors = await db('vendors')
        .where(function() { this.where('company_id', companyId).orWhereNull('company_id'); })
        .orderBy('id', 'asc')
        .catch(() => []);

      data.journal_entries = await db('journal_entries').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const entryIds = data.journal_entries.map(e => e.id);
      data.journal_lines = entryIds.length > 0
        ? await db('journal_lines').whereIn('entry_id', entryIds).orderBy('id', 'asc').catch(() => [])
        : [];
      data.vouchers = await db('vouchers').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
    }

    if (type === 'full' || type === 'inventory') {
      data.warehouses = await db('warehouses')
        .where(function() { this.where('company_id', companyId).orWhereNull('company_id'); })
        .orderBy('id', 'asc')
        .catch(() => []);
      data.products = await db('products').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);

      const productIds = data.products.map(p => p.id);
      data.inventory = productIds.length > 0
        ? await db('inventory').whereIn('product_id', productIds).orderBy('id', 'asc').catch(() => [])
        : [];
      data.stock_logs = productIds.length > 0
        ? await db('stock_logs').whereIn('product_id', productIds).orderBy('id', 'asc').catch(() => [])
        : [];
      data.inventory_layers = await db('inventory_layers').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.inventory_transfers = await db('inventory_transfers').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
    }

    if (type === 'full') {
      if (!data.clients) {
        data.clients = await db('clients')
          .where(function() { this.where('company_id', companyId).orWhereNull('company_id'); })
          .orderBy('id', 'asc')
          .catch(() => []);
      }
      if (!data.vendors) {
        data.vendors = await db('vendors')
          .where(function() { this.where('company_id', companyId).orWhereNull('company_id'); })
          .orderBy('id', 'asc')
          .catch(() => []);
      }

      // Procurement Pipeline
      data.purchase_requisitions = await db('purchase_requisitions').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const reqIds = data.purchase_requisitions.map(r => r.id);
      data.purchase_requisition_items = reqIds.length > 0
        ? await db('purchase_requisition_items').whereIn('requisition_id', reqIds).orderBy('id', 'asc').catch(() => [])
        : [];

      data.purchase_orders = await db('purchase_orders').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const poIds = data.purchase_orders.map(p => p.id);
      data.purchase_order_items = poIds.length > 0
        ? await db('purchase_order_items').whereIn('purchase_order_id', poIds).orderBy('id', 'asc').catch(() => [])
        : [];

      data.goods_receipts = await db('goods_receipts').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const grnIds = data.goods_receipts.map(g => g.id);
      data.goods_receipt_items = grnIds.length > 0
        ? await db('goods_receipt_items').whereIn('goods_receipt_id', grnIds).orderBy('id', 'asc').catch(() => [])
        : [];

      // Sales & Distribution Deliveries
      data.sales_orders = await db('sales_orders').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const soIds = data.sales_orders.map(s => s.id);
      data.sales_order_items = soIds.length > 0
        ? await db('sales_order_items').whereIn('sales_order_id', soIds).orderBy('id', 'asc').catch(() => [])
        : [];

      data.sectors = await db('sectors').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.deliveries = await db('deliveries').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const delIds = data.deliveries.map(d => d.id);
      data.delivery_items = delIds.length > 0
        ? await db('delivery_items').whereIn('delivery_id', delIds).orderBy('id', 'asc').catch(() => [])
        : [];

      // HR & Payroll Workspace
      data.employees = await db('employees').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.salary_structures = await db('salary_structures').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.payroll_runs = await db('payroll_runs').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      const prIds = data.payroll_runs.map(pr => pr.id);
      data.employee_payslips = prIds.length > 0
        ? await db('employee_payslips').whereIn('payroll_run_id', prIds).orderBy('id', 'asc').catch(() => [])
        : [];
      data.employee_loans = await db('employee_loans').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);

      // Asset Management & Budgets
      data.asset_categories = await db('asset_categories').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.assets = await db('assets').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.fixed_assets = await db('fixed_assets').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
      data.budgets = await db('budgets').where({ company_id: companyId }).orderBy('id', 'asc').catch(() => []);
    }

    if (req.query.format === 'xlsx') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ACCOUNTELLENCE System';
      workbook.lastModifiedBy = req.user?.name || 'System Admin';
      workbook.created = new Date();

      // 1. Executive Overview / Cover Sheet
      const overviewSheet = workbook.addWorksheet('Executive Overview', {
        views: [{ showGridLines: true }]
      });

      // Executive Title Banner
      overviewSheet.mergeCells('A1:E2');
      const titleCell = overviewSheet.getCell('A1');
      titleCell.value = 'ACCOUNTELLENCE — Enterprise Workspace Data Backup';
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      overviewSheet.mergeCells('A3:E3');
      const subCell = overviewSheet.getCell('A3');
      subCell.value = `Workspace: ${company ? company.name : 'System Workspace'} | Export Date: ${new Date().toLocaleString()} | Security Audit: SHA-256 Hash Chained`;
      subCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'ECFDF5' } };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '047857' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Summary Info Section
      const summaryRows = [
        ['', ''],
        ['Workspace ID', companyId],
        ['Company Name', company ? company.name : 'Unknown Workspace'],
        ['Backup Scope', type.toUpperCase()],
        ['Exported By', `${req.user?.name || 'Admin'} (${req.user?.email || 'admin@sarfis.com'})`],
        ['Timestamp (UTC)', new Date().toISOString()],
        ['', ''],
        ['MODULE ENTITY TABLE', 'EXPORTED RECORD COUNT']
      ];

      summaryRows.forEach((r, rIdx) => {
        const row = overviewSheet.addRow(r);
        row.height = 22;
        if (rIdx === 7) {
          row.eachCell(c => {
            c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '065F46' } };
            c.alignment = { horizontal: 'left', vertical: 'middle' };
          });
        } else if (rIdx > 0 && rIdx < 6) {
          const c1 = row.getCell(1);
          const c2 = row.getCell(2);
          c1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '334155' } };
          c2.font = { name: 'Segoe UI', size: 10, color: { argb: '0F172A' } };
        }
      });

      // Module Tables Record Counts
      let totalRecords = 0;
      for (const [tName, rows] of Object.entries(data)) {
        const count = rows ? rows.length : 0;
        totalRecords += count;
        const row = overviewSheet.addRow([tName.toUpperCase(), count]);
        row.height = 20;
        row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: '047857' } };
        row.getCell(2).font = { name: 'Segoe UI', size: 9.5, color: { argb: '0F172A' } };
      }

      const totRow = overviewSheet.addRow(['TOTAL BACKUP RECORDS', totalRecords]);
      totRow.height = 24;
      totRow.eachCell(c => {
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '064E3B' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ECFDF5' } };
        c.border = { top: { style: 'medium', color: { argb: '059669' } }, bottom: { style: 'double', color: { argb: '059669' } } };
      });

      overviewSheet.columns = [
        { width: 32 },
        { width: 45 },
        { width: 25 },
        { width: 25 },
        { width: 25 }
      ];

      // Metadata Sheet for Automated Parser Compatibility
      const metaSheet = workbook.addWorksheet('Metadata');
      metaSheet.columns = [
        { header: 'Key', key: 'key', width: 25 },
        { header: 'Value', key: 'value', width: 45 }
      ];
      metaSheet.addRow({ key: 'companyId', value: companyId });
      metaSheet.addRow({ key: 'companyName', value: company ? company.name : 'Unknown Workspace' });
      metaSheet.addRow({ key: 'backupType', value: type });
      metaSheet.addRow({ key: 'timestamp', value: new Date().toISOString() });

      // 2. Individual Formatted Entity Sheets
      for (const [tableName, rows] of Object.entries(data)) {
        const sheetName = tableName.substring(0, 31);
        const sheet = workbook.addWorksheet(sheetName, {
          views: [{ showGridLines: true }]
        });

        if (rows && rows.length > 0) {
          const headers = Object.keys(rows[0]);

          // Header Row
          const headerRow = sheet.addRow(headers);
          headerRow.height = 26;
          headerRow.eachCell((cell) => {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '065F46' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: '047857' } },
              bottom: { style: 'medium', color: { argb: '022C22' } },
              left: { style: 'thin', color: { argb: '047857' } },
              right: { style: 'thin', color: { argb: '047857' } }
            };
          });

          // Compute max column widths
          const colWidths = {};
          headers.forEach(h => { colWidths[h] = h.length; });

          // Add Data Rows
          rows.forEach((rowObj, idx) => {
            const rowValues = headers.map(h => {
              let val = rowObj[h];
              if (val !== null && val !== undefined) {
                if (typeof val === 'object') val = JSON.stringify(val);
                const valStr = String(val);
                if (valStr.length > (colWidths[h] || 0)) {
                  colWidths[h] = Math.min(valStr.length, 60);
                }
              }
              return val;
            });

            const dataRow = sheet.addRow(rowValues);
            dataRow.height = 20;
            const isEven = idx % 2 === 0;

            dataRow.eachCell((cell) => {
              cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: '0F172A' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFFFFF' : 'F8FAFC' }
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
              };

              // Format numbers as currency & text as left-aligned
              if (typeof cell.value === 'number') {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0.00';
              } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
              }
            });
          });

          // Apply auto column widths
          sheet.columns = headers.map(h => ({
            key: h,
            width: Math.max((colWidths[h] || 10) + 5, 14)
          }));
        } else {
          sheet.addRow(['No records available for this entity module.']);
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
      if (data.employee_payslips) {
        await trx('employee_payslips').whereIn('payroll_run_id', trx('payroll_runs').where('company_id', companyId).select('id')).del().catch(() => { });
      }
      if (data.payroll_runs) {
        await trx('payroll_runs').where('company_id', companyId).del().catch(() => { });
      }
      if (data.employees) {
        await trx('employees').where('company_id', companyId).del().catch(() => { });
      }
      if (data.delivery_items) {
        await trx('delivery_items').whereIn('delivery_id', trx('deliveries').where('company_id', companyId).select('id')).del().catch(() => { });
      }
      if (data.deliveries) {
        await trx('deliveries').where('company_id', companyId).del().catch(() => { });
      }
      if (data.sectors) {
        await trx('sectors').where('company_id', companyId).del().catch(() => { });
      }
      if (data.assets) {
        await trx('assets').where('company_id', companyId).del().catch(() => { });
      }
      if (data.asset_categories) {
        await trx('asset_categories').where('company_id', companyId).del().catch(() => { });
      }
      if (data.fixed_assets) {
        await trx('fixed_assets').where('company_id', companyId).del().catch(() => { });
      }
      if (data.budgets) {
        await trx('budgets').where('company_id', companyId).del().catch(() => { });
      }
      if (data.sales_order_items) {
        await trx('sales_order_items').whereIn('sales_order_id', trx('sales_orders').where('company_id', companyId).select('id')).del().catch(() => { });
      }
      if (data.sales_orders) {
        await trx('sales_orders').where('company_id', companyId).del().catch(() => { });
      }
      if (data.goods_receipt_items) {
        await trx('goods_receipt_items').whereIn('goods_receipt_id', trx('goods_receipts').where('company_id', companyId).select('id')).del().catch(() => { });
      }
      if (data.goods_receipts) {
        await trx('goods_receipts').where('company_id', companyId).del().catch(() => { });
      }
      if (data.purchase_order_items) {
        await trx('purchase_order_items').whereIn('purchase_order_id', trx('purchase_orders').where('company_id', companyId).select('id')).del().catch(() => { });
      }
      if (data.purchase_orders) {
        await trx('purchase_orders').where('company_id', companyId).del().catch(() => { });
      }
      if (data.purchase_requisition_items) {
        await trx('purchase_requisition_items').whereIn('requisition_id', trx('purchase_requisitions').where('company_id', companyId).select('id')).del().catch(() => { });
      }
      if (data.purchase_requisitions) {
        await trx('purchase_requisitions').where('company_id', companyId).del().catch(() => { });
      }
      if (data.inventory_layers) {
        await trx('inventory_layers').where('company_id', companyId).del().catch(() => { });
      }
      if (data.inventory_transfers) {
        await trx('inventory_transfers').where('company_id', companyId).del().catch(() => { });
      }
      if (data.company_accounting_settings) {
        await trx('company_accounting_settings').where('company_id', companyId).del().catch(() => { });
      }
      if (data.settings) {
        await trx('settings').where({ scope: 'company', target_id: String(companyId) }).del().catch(() => { });
      }
      if (data.vouchers) {
        await trx('vouchers').where('company_id', companyId).del().catch(() => { });
      }
      if (data.journal_lines) {
        const entryIds = await trx('journal_entries').where('company_id', companyId).select('id');
        const ids = entryIds.map(e => e.id);
        if (ids.length > 0) {
          await trx('journal_lines').whereIn('entry_id', ids).del().catch(() => { });
        }
      }
      if (data.journal_entries) {
        await trx('journal_entries').where('company_id', companyId).del().catch(() => { });
      }
      if (data.stock_logs) {
        const prodIds = await trx('products').where('company_id', companyId).select('id');
        const ids = prodIds.map(p => p.id);
        if (ids.length > 0) {
          await trx('stock_logs').whereIn('product_id', ids).del().catch(() => { });
        }
      }
      if (data.inventory) {
        const prodIds = await trx('products').where('company_id', companyId).select('id');
        const ids = prodIds.map(p => p.id);
        if (ids.length > 0) {
          await trx('inventory').whereIn('product_id', ids).del().catch(() => { });
        }
      }
      if (data.products) {
        await trx('products').where('company_id', companyId).del().catch(() => { });
      }
      if (data.clients) {
        await trx('clients').where('company_id', companyId).del().catch(() => { });
      }
      if (data.vendors) {
        await trx('vendors').where('company_id', companyId).del().catch(() => { });
      }
      if (data.accounts) {
        await trx('accounts').where('company_id', companyId).del().catch(() => { });
      }

      // ID Remapping dictionaries across child entities
      const idMaps = {
        accounts: {},
        clients: {},
        vendors: {},
        products: {},
        journal_entries: {},
        purchase_requisitions: {},
        purchase_orders: {},
        goods_receipts: {},
        sales_orders: {},
        payroll_runs: {},
        sectors: {},
        deliveries: {},
        asset_categories: {},
        assets: {}
      };

      // 2. Helper to insert tables safely avoiding primary key collisions
      const insertTableSafely = async (tableName, rows) => {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return;

        // For settings table, strip 'id' so DB auto-increments and scope/target_id unique key works
        if (tableName === 'settings') {
          const sanitized = rows.map(r => {
            const mapped = { ...r };
            delete mapped.id;
            mapped.scope = 'company';
            mapped.target_id = String(companyId);
            return mapped;
          });
          await trx('settings').insert(sanitized);
          return;
        }

        // For company_accounting_settings, strip 'id' and set company_id
        if (tableName === 'company_accounting_settings') {
          const sanitized = rows.map(r => {
            const mapped = { ...r };
            delete mapped.id;
            mapped.company_id = companyId;
            return mapped;
          });
          await trx('company_accounting_settings').insert(sanitized);
          return;
        }

        // Fetch existing IDs in database for this table to detect collisions across companies
        const existingIdRows = await trx(tableName).select('id').catch(() => []);
        const existingIds = new Set(existingIdRows.map(r => String(r.id)));

        for (const row of rows) {
          const mapped = { ...row };
          if (mapped.hasOwnProperty('company_id')) {
            mapped.company_id = companyId;
          }

          // Remap foreign key pointers if parent IDs changed
          if (tableName === 'journal_lines') {
            if (mapped.entry_id && idMaps.journal_entries[mapped.entry_id]) {
              mapped.entry_id = idMaps.journal_entries[mapped.entry_id];
            }
            if (mapped.account_id && idMaps.accounts[mapped.account_id]) {
              mapped.account_id = idMaps.accounts[mapped.account_id];
            }
          }
          if (tableName === 'inventory' || tableName === 'stock_logs' || tableName === 'inventory_layers') {
            if (mapped.product_id && idMaps.products[mapped.product_id]) {
              mapped.product_id = idMaps.products[mapped.product_id];
            }
          }
          if (tableName === 'purchase_requisition_items') {
            if (mapped.requisition_id && idMaps.purchase_requisitions[mapped.requisition_id]) {
              mapped.requisition_id = idMaps.purchase_requisitions[mapped.requisition_id];
            }
          }
          if (tableName === 'purchase_order_items') {
            if (mapped.purchase_order_id && idMaps.purchase_orders[mapped.purchase_order_id]) {
              mapped.purchase_order_id = idMaps.purchase_orders[mapped.purchase_order_id];
            }
          }
          if (tableName === 'goods_receipt_items') {
            if (mapped.goods_receipt_id && idMaps.goods_receipts[mapped.goods_receipt_id]) {
              mapped.goods_receipt_id = idMaps.goods_receipts[mapped.goods_receipt_id];
            }
          }
          if (tableName === 'sales_order_items') {
            if (mapped.sales_order_id && idMaps.sales_orders[mapped.sales_order_id]) {
              mapped.sales_order_id = idMaps.sales_orders[mapped.sales_order_id];
            }
          }
          if (tableName === 'deliveries') {
            if (mapped.client_id && idMaps.clients[mapped.client_id]) {
              mapped.client_id = idMaps.clients[mapped.client_id];
            }
            if (mapped.sector_id && idMaps.sectors[mapped.sector_id]) {
              mapped.sector_id = idMaps.sectors[mapped.sector_id];
            }
          }
          if (tableName === 'delivery_items') {
            delete mapped.line_total;
            delete mapped.line_cost;
            delete mapped['line_total'];
            delete mapped['line_cost'];
            if (mapped.delivery_id && idMaps.deliveries[mapped.delivery_id]) {
              mapped.delivery_id = idMaps.deliveries[mapped.delivery_id];
            }
            if (mapped.product_id && idMaps.products[mapped.product_id]) {
              mapped.product_id = idMaps.products[mapped.product_id];
            }
          }
          if (tableName === 'assets') {
            if (mapped.category_id && idMaps.asset_categories[mapped.category_id]) {
              mapped.category_id = idMaps.asset_categories[mapped.category_id];
            }
          }
          if (tableName === 'employee_payslips') {
            if (mapped.payroll_run_id && idMaps.payroll_runs[mapped.payroll_run_id]) {
              mapped.payroll_run_id = idMaps.payroll_runs[mapped.payroll_run_id];
            }
          }

          const origId = mapped.id;
          if (origId !== undefined && origId !== null) {
            if (existingIds.has(String(origId))) {
              delete mapped.id; // Let DB assign new auto-increment ID to prevent duplicate key error
            }
          }

          const result = await trx(tableName).insert(mapped).returning('id').catch(async () => {
            delete mapped.id;
            return await trx(tableName).insert(mapped).returning('id');
          });
          let insertedId = result;
          if (Array.isArray(result) && result.length > 0) {
            insertedId = typeof result[0] === 'object' ? result[0].id : result[0];
          }

          if (origId !== undefined && insertedId !== undefined && idMaps[tableName]) {
            idMaps[tableName][origId] = insertedId;
          }
        }

        // Reset PostgreSQL primary key sequence if needed
        const hasId = rows[0] && rows[0].hasOwnProperty('id');
        if (hasId) {
          try {
            const [{ max }] = await trx(tableName).max('id as max');
            if (max && typeof max === 'number') {
              await trx.raw(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${max})`);
            }
          } catch (seqErr) {
            // Ignore sequence reset error on non-serial or SQLite
          }
        }
      };

      // Order of insertions to satisfy relational foreign keys
      if (data.settings) await insertTableSafely('settings', data.settings);
      if (data.company_accounting_settings) await insertTableSafely('company_accounting_settings', data.company_accounting_settings);
      if (data.company_tax_settings) await insertTableSafely('company_tax_settings', data.company_tax_settings);
      if (data.accounting_periods) await insertTableSafely('accounting_periods', data.accounting_periods);
      if (data.fiscal_years) await insertTableSafely('fiscal_years', data.fiscal_years);
      if (data.accounts) await insertTableSafely('accounts', data.accounts);
      if (data.clients) await insertTableSafely('clients', data.clients);
      if (data.vendors) await insertTableSafely('vendors', data.vendors);
      if (data.warehouses) await insertTableSafely('warehouses', data.warehouses);
      if (data.products) await insertTableSafely('products', data.products);
      if (data.inventory) await insertTableSafely('inventory', data.inventory);
      if (data.inventory_layers) await insertTableSafely('inventory_layers', data.inventory_layers);
      if (data.inventory_transfers) await insertTableSafely('inventory_transfers', data.inventory_transfers);
      if (data.journal_entries) await insertTableSafely('journal_entries', data.journal_entries);
      if (data.journal_lines) await insertTableSafely('journal_lines', data.journal_lines);
      if (data.vouchers) await insertTableSafely('vouchers', data.vouchers);
      if (data.stock_logs) await insertTableSafely('stock_logs', data.stock_logs);
      if (data.purchase_requisitions) await insertTableSafely('purchase_requisitions', data.purchase_requisitions);
      if (data.purchase_requisition_items) await insertTableSafely('purchase_requisition_items', data.purchase_requisition_items);
      if (data.purchase_orders) await insertTableSafely('purchase_orders', data.purchase_orders);
      if (data.purchase_order_items) await insertTableSafely('purchase_order_items', data.purchase_order_items);
      if (data.goods_receipts) await insertTableSafely('goods_receipts', data.goods_receipts);
      if (data.goods_receipt_items) await insertTableSafely('goods_receipt_items', data.goods_receipt_items);
      if (data.sales_orders) await insertTableSafely('sales_orders', data.sales_orders);
      if (data.sales_order_items) await insertTableSafely('sales_order_items', data.sales_order_items);
      if (data.sectors) await insertTableSafely('sectors', data.sectors);
      if (data.deliveries) await insertTableSafely('deliveries', data.deliveries);
      if (data.delivery_items) await insertTableSafely('delivery_items', data.delivery_items);
      if (data.employees) await insertTableSafely('employees', data.employees);
      if (data.salary_structures) await insertTableSafely('salary_structures', data.salary_structures);
      if (data.payroll_runs) await insertTableSafely('payroll_runs', data.payroll_runs);
      if (data.employee_payslips) await insertTableSafely('employee_payslips', data.employee_payslips);
      if (data.employee_loans) await insertTableSafely('employee_loans', data.employee_loans);
      if (data.asset_categories) await insertTableSafely('asset_categories', data.asset_categories);
      if (data.assets) await insertTableSafely('assets', data.assets);
      if (data.fixed_assets) await insertTableSafely('fixed_assets', data.fixed_assets);
      if (data.budgets) await insertTableSafely('budgets', data.budgets);
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
      if (sheet.name === 'Metadata' || sheet.name === 'Executive Overview') return;

      const tableName = sheet.name;
      const rows = [];
      let headers = [];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          headers = row.values.slice(1);
        } else {
          if (!headers || headers.length === 0 || headers[0] === 'No records available for this entity module.') return;

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

      if (headers && headers.length > 0 && headers[0] !== 'No records available for this entity module.') {
        backup.data[tableName] = rows;
      }
    });

    if (!backup.backupType) backup.backupType = 'full';
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
    if (!company || company.name.trim().toLowerCase() !== companyName.trim().toLowerCase()) {
      return res.status(400).json({ message: 'Company name confirmation mismatch.' });
    }

    // 3. Execute purge transactionally
    await db.transaction(async (trx) => {
      await trx('transaction_audit_logs').where('company_id', companyId).del().catch(() => { });

      const entryIds = await trx('journal_entries').where('company_id', companyId).select('id');
      const ids = entryIds.map(e => e.id);
      if (ids.length > 0) {
        await trx('journal_lines').whereIn('entry_id', ids).del().catch(() => { });
      }
      await trx('journal_entries').where('company_id', companyId).del().catch(() => { });
      await trx('vouchers').where('company_id', companyId).del().catch(() => { });

      // Requisitions, POs, GRNs, & Sales Orders
      const reqIds = await trx('purchase_requisitions').where('company_id', companyId).select('id');
      const rqids = reqIds.map(r => r.id);
      if (rqids.length > 0) {
        await trx('purchase_requisition_items').whereIn('purchase_requisition_id', rqids).del().catch(() => { });
      }
      await trx('purchase_requisitions').where('company_id', companyId).del().catch(() => { });

      const poIds = await trx('purchase_orders').where('company_id', companyId).select('id');
      const poids = poIds.map(p => p.id);
      if (poids.length > 0) {
        await trx('purchase_order_items').whereIn('purchase_order_id', poids).del().catch(() => { });
      }
      await trx('purchase_orders').where('company_id', companyId).del().catch(() => { });

      const grnIds = await trx('goods_receipts').where('company_id', companyId).select('id');
      const grnids = grnIds.map(g => g.id);
      if (grnids.length > 0) {
        await trx('goods_receipt_items').whereIn('goods_receipt_id', grnids).del().catch(() => { });
      }
      await trx('goods_receipts').where('company_id', companyId).del().catch(() => { });

      const soIds = await trx('sales_orders').where('company_id', companyId).select('id');
      const soids = soIds.map(s => s.id);
      if (soids.length > 0) {
        await trx('sales_order_items').whereIn('sales_order_id', soids).del().catch(() => { });
      }
      await trx('sales_orders').where('company_id', companyId).del().catch(() => { });

      // Inventory Stock Logs & Valuation Layers
      await trx('inventory_layers').where('company_id', companyId).del().catch(() => { });
      await trx('inventory_transfers').where('company_id', companyId).del().catch(() => { });

      const prodIds = await trx('products').where('company_id', companyId).select('id');
      const pids = prodIds.map(p => p.id);
      if (pids.length > 0) {
        await trx('stock_logs').whereIn('product_id', pids).del().catch(() => { });
        await trx('inventory').whereIn('product_id', pids).update({ quantity: 0 }).catch(() => { });
      }

      await trx('clients').where('company_id', companyId).update({ current_balance: 0 }).catch(() => { });
      await trx('vendors').where('company_id', companyId).update({ current_balance: 0 }).catch(() => { });
      await trx('accounts').where('company_id', companyId).update({ balance: 0 }).catch(() => { });

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

exports.getCompanyInvitations = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const invitations = await db('user_access_invitations')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');

    const subscription = await db('company_subscriptions').where({ company_id: companyId }).first();
    const maxLicenses = subscription ? subscription.max_user_licenses : 50;
    const activeUsersCountRes = await db('company_users').where({ company_id: companyId }).count('* as cnt').first();
    const activeUsersCount = parseInt(activeUsersCountRes.cnt || 0);

    res.json({
      invitations,
      licenseUsage: {
        used: activeUsersCount,
        max: maxLicenses
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.createCompanyInvitation = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const { email, roleName } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user is already a member
    const existingUser = await db('users').where({ email: normalizedEmail }).first();
    if (existingUser) {
      const isMember = await db('company_users').where({ company_id: companyId, user_id: existingUser.id }).first();
      if (isMember) {
        return res.status(400).json({ error: 'This user is already an active member of this workspace.' });
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiration

    await db('user_access_invitations')
      .insert({
        company_id: companyId,
        email: normalizedEmail,
        invitation_status: 'PENDING',
        role_name: roleName || 'Accountant',
        expires_at: expiresAt,
        invited_by: req.user.id
      })
      .onConflict(['company_id', 'email'])
      .merge({
        invitation_status: 'PENDING',
        role_name: roleName || 'Accountant',
        expires_at: expiresAt,
        invited_by: req.user.id,
        updated_at: db.fn.now()
      });

    res.json({ success: true, message: 'Workspace invitation sent successfully' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.revokeCompanyInvitation = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const invitationId = parseInt(req.params.invitationId, 10);
    await assertCompanyAdmin(req, companyId);

    await db('user_access_invitations')
      .where({ id: invitationId, company_id: companyId })
      .update({ invitation_status: 'REVOKED' });

    res.json({ success: true, message: 'Invitation revoked' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getCompanyAuthSettings = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    let settings = await db('company_auth_settings').where({ company_id: companyId }).first();
    if (!settings) {
      const [newSettings] = await db('company_auth_settings').insert({
        company_id: companyId,
        google_login_enabled: false,
        allow_google_account_linking: false,
        allowed_google_domains: JSON.stringify([])
      }).returning('*');
      settings = newSettings;
    }

    res.json(settings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateCompanyAuthSettings = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    await assertCompanyAdmin(req, companyId);

    const google_login_enabled = req.body.google_login_enabled !== undefined ? req.body.google_login_enabled : req.body.googleLoginEnabled;
    const allow_google_account_linking = req.body.allow_google_account_linking !== undefined ? req.body.allow_google_account_linking : req.body.allowGoogleAccountLinking;
    const allow_google_auto_provisioning = req.body.allow_google_auto_provisioning !== undefined ? req.body.allow_google_auto_provisioning : req.body.allowGoogleAutoProvisioning;
    const allowed_google_domains = req.body.allowed_google_domains !== undefined ? req.body.allowed_google_domains : req.body.allowedGoogleDomains;

    let parsedDomains = allowed_google_domains;
    if (typeof allowed_google_domains === 'string') {
      parsedDomains = allowed_google_domains.split(',').map(d => d.trim()).filter(Boolean);
    }

    const payload = {
      google_login_enabled: !!google_login_enabled,
      allow_google_account_linking: !!allow_google_account_linking,
      allow_google_auto_provisioning: !!allow_google_auto_provisioning,
      allowed_google_domains: Array.isArray(parsedDomains) ? JSON.stringify(parsedDomains) : null,
      updated_at: db.fn.now()
    };

    const existing = await db('company_auth_settings').where({ company_id: companyId }).first();
    if (existing) {
      await db('company_auth_settings').where({ company_id: companyId }).update(payload);
    } else {
      await db('company_auth_settings').insert({ company_id: companyId, ...payload });
    }

    res.json({ success: true, message: 'Authentication policies updated successfully' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

