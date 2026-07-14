const AuthService = require('../services/auth.service');
const UserModel = require('../models/user.model');

exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const device = req.headers['user-agent'] || 'Unknown';
  
  try {
    const { user, token } = await AuthService.registerUser({
      name,
      email,
      password,
      role,
      ip,
      device
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error detail:', err);
    res.status(err.message.includes('required') || err.message.includes('exists') ? 400 : 500).json({ message: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const device = req.headers['user-agent'] || 'Unknown';
  try {
    const result = await AuthService.loginUser({ email, password, ip, device });
    res.json(result);
  } catch (err) {
    res.status(err.message.includes('required') || err.message.includes('credentials') ? 401 : 500).json({ message: err.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by authMiddleware
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ 
      user, 
      permissions: req.userPermissions || [],
      companyRole: req.userCompanyRole || null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.seedKhaanUser = async (req, res) => {
  const db = require('../config/db');
  const bcrypt = require('bcrypt');

  const email = 'khaan@gmail.com';
  const rawPassword = 'khaan123';
  const companyName = 'Khaan Tech Solutions';

  try {
    console.log('Seeding UAT database for khaan@gmail.com...');

    // 1. Check if user already exists
    const existingUser = await db('users').where({ email: email }).first();
    let companyId;
    let userId;

    if (existingUser) {
      const cu = await db('company_users').where({ user_id: existingUser.id }).first();
      companyId = cu ? cu.company_id : null;
      userId = existingUser.id;
      
      if (companyId) {
        // Delete existing records linked to this company/user in correct order
        await db('user_roles').where({ user_id: userId }).del();
        await db('company_users').where({ user_id: userId }).del();
        await db('journal_lines').whereIn('entry_id', function() {
          this.select('id').from('journal_entries').where({ company_id: companyId });
        }).del();
        await db('journal_entries').where({ company_id: companyId }).del();
        await db('budget_control_lines').whereIn('budget_header_id', function() {
          this.select('id').from('budget_headers').where({ company_id: companyId });
        }).del();
        await db('budget_headers').where({ company_id: companyId }).del();
        await db('assets').where({ company_id: companyId }).del();
        await db('asset_categories').where({ company_id: companyId }).del();
        await db('business_relationship_status').where({ company_id: companyId }).del();
        await db('products').where({ company_id: companyId }).del();
        await db('warehouses').where({ company_id: companyId }).del();
        await db('clients').where({ company_id: companyId }).del();
        await db('vendors').where({ company_id: companyId }).del();
        await db('company_accounting_settings').where({ company_id: companyId }).del();
        await db('accounting_periods').where({ company_id: companyId }).del();
        await db('accounts').where({ company_id: companyId }).del();
        await db('settings').where({ scope: 'company', target_id: String(companyId) }).del();
        await db('users').where({ id: userId }).del();
        await db('companies').where({ id: companyId }).del();
      } else {
        await db('users').where({ id: userId }).del();
      }
    }

    // 2. Insert Company fresh
    const [newCompany] = await db('companies').insert({ name: companyName }).returning('id');
    companyId = typeof newCompany === 'object' ? newCompany.id : newCompany;

    // 3. Insert User fresh
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const [newUser] = await db('users').insert({
      email: email,
      password: hashedPassword,
      name: 'Khaan Admin',
      role: 'Company Admin'
    }).returning('id');
    userId = typeof newUser === 'object' ? newUser.id : newUser;

    // 4. Map User to Company in company_users
    await db('company_users').insert({
      user_id: userId,
      company_id: companyId,
      role: 'Company Admin'
    });

    // 4b. Link User to Admin role (role_id: 1) in user_roles table
    await db('user_roles').insert({
      user_id: userId,
      company_id: companyId,
      role_id: 1 // Admin role
    });

    // 5. Enable all features in settings table
    await db('settings').insert({
      scope: 'company',
      target_id: String(companyId),
      value: JSON.stringify({
        companyName: companyName,
        ntn: 'NTN-7777777-7',
        strn: 'STRN-5555555-5',
        address: 'Industrial Zone Phase 3, Karachi',
        baseCurrency: 'PKR',
        accentColor: '#10b981',
        budgetingEnabled: true,
        riskEnabled: true,
        inventoryEnabled: true,
        warehousingEnabled: true,
        payrollEnabled: true
      })
    });

    // 6. Create Chart of Accounts
    const accountData = [
      { company_id: companyId, code: '1010', name: 'Cash', category: 'Asset', balance: 2500000, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '1030', name: 'Main Bank Account', category: 'Asset', balance: 5000000, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '1200', name: 'Accounts Receivable', category: 'Asset', balance: 1200000, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '1300', name: 'Inventory', category: 'Asset', balance: 800000, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '1500', name: 'Office Servers', category: 'Asset', balance: 1500000, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '1599', name: 'Accumulated Depreciation', category: 'Asset', balance: -300000, normal_balance: 'Credit', is_contra: true, is_control: false, is_postable: true },
      { company_id: companyId, code: '2010', name: 'Accounts Payable', category: 'Liability', balance: 900000, normal_balance: 'Credit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '2200', name: 'Sales Tax Payable', category: 'Liability', balance: 150000, normal_balance: 'Credit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '3010', name: 'Owner\'s Capital', category: 'Equity', balance: 5000000, normal_balance: 'Credit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '4010', name: 'Sales Revenue', category: 'Revenue', balance: 0, normal_balance: 'Credit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '6020', name: 'Rent Expense', category: 'Expense', balance: 0, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '6010', name: 'Salaries Expense', category: 'Expense', balance: 0, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '6040', name: 'Marketing Expense', category: 'Expense', balance: 0, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true },
      { company_id: companyId, code: '6060', name: 'Depreciation Expense', category: 'Expense', balance: 0, normal_balance: 'Debit', is_contra: false, is_control: false, is_postable: true }
    ];
    await db('accounts').insert(accountData);

    const accounts = (await db('accounts').where({ company_id: companyId })).reduce((acc, curr) => {
      acc[curr.name.replace(/[^a-zA-Z]/g, '')] = curr.id;
      return acc;
    }, {});

    // 7. Seed Accounting Settings
    await db('company_accounting_settings').insert({
      company_id: companyId,
      default_sales_account_id: accounts.SalesRevenue,
      default_ap_account_id: accounts.AccountsPayable,
      default_ar_account_id: accounts.AccountsReceivable,
      default_inventory_account_id: accounts.Inventory,
      default_cogs_account_id: accounts.DepreciationExpense,
      default_cash_account_id: accounts.Cash,
      tax_rate: 17.0,
      default_tax_payable_account_id: accounts.SalesTaxPayable
    });

    // 8. Seed Financial Periods for 2026
    const periodData = [];
    for (let month = 1; month <= 12; month++) {
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const periodName = `2026-${monthStr}`;
      periodData.push({
        company_id: companyId,
        period_name: periodName,
        start_date: `2026-${monthStr}-01`,
        end_date: new Date(2026, month, 0).toISOString().split('T')[0],
        status: 'OPEN'
      });
    }
    await db('accounting_periods').insert(periodData);

    // 9. Simulate 12 Months of Transactions (trends & analytics)
    const today = new Date();
    for (let m = 11; m >= 0; m--) {
      const entryDate = new Date(today.getFullYear(), today.getMonth() - m, 15);
      const label = entryDate.toLocaleString('default', { month: 'short' });

      const rev = 400000 + Math.floor(Math.random() * 200000);
      const sal = 180000;
      const rent = 80000;
      const marketing = 40000 + Math.floor(Math.random() * 20000);

      // Sales entry
      const [se] = await db('journal_entries').insert({
        company_id: companyId,
        entry_date: entryDate,
        description: `Sales Revenue for ${label}`,
        status: 'POSTED'
      }).returning('id');
      const seId = typeof se === 'object' ? se.id : se;

      await db('journal_lines').insert([
        { entry_id: seId, account_id: accounts.AccountsReceivable, debit: rev, credit: 0 },
        { entry_id: seId, account_id: accounts.SalesRevenue, debit: 0, credit: rev }
      ]);

      // Expenses entry
      const [ee] = await db('journal_entries').insert({
        company_id: companyId,
        entry_date: entryDate,
        description: `Operating Expenses for ${label}`,
        status: 'POSTED'
      }).returning('id');
      const eeId = typeof ee === 'object' ? ee.id : ee;

      await db('journal_lines').insert([
        { entry_id: eeId, account_id: accounts.RentExpense, debit: rent, credit: 0 },
        { entry_id: eeId, account_id: accounts.SalariesExpense, debit: sal, credit: 0 },
        { entry_id: eeId, account_id: accounts.MarketingExpense, debit: marketing, credit: 0 },
        { entry_id: eeId, account_id: accounts.MainBankAccount, debit: 0, credit: rent + sal + marketing }
      ]);
    }

    // 10. Seed Budget & Control Line (budget vs actual)
    const [bh] = await db('budget_headers').insert({
      company_id: companyId,
      name: 'FY 2026 Core Operating Budget',
      fiscal_year: '2026',
      status: 'ACTIVE'
    }).returning('id');
    const bhId = typeof bh === 'object' ? bh.id : bh;

    await db('budget_control_lines').insert([
      { budget_header_id: bhId, department: 'Marketing', account_id: accounts.MarketingExpense, allocated_amount: 1500000, alert_threshold_pct: 90, control_level: 'BLOCK' },
      { budget_header_id: bhId, department: 'Finance', account_id: accounts.SalariesExpense, allocated_amount: 2500000, alert_threshold_pct: 95, control_level: 'WARN' },
      { budget_header_id: bhId, department: 'HQ', account_id: accounts.RentExpense, allocated_amount: 1000000, alert_threshold_pct: 90, control_level: 'BLOCK' }
    ]);

    // 11. Seed Fixed Assets
    const [cat] = await db('asset_categories').insert({
      company_id: companyId,
      category_name: 'IT Infrastructure',
      default_depreciation_method: 'Straight Line',
      default_useful_life_years: 5,
      default_salvage_percent: 10,
      asset_account_id: accounts.OfficeServers,
      depreciation_expense_account_id: accounts.DepreciationExpense,
      accumulated_depreciation_account_id: accounts.AccumulatedDepreciation
    }).returning('id');
    const catId = typeof cat === 'object' ? cat.id : cat;

    await db('assets').insert([
      { company_id: companyId, category_id: catId, asset_code: 'ASSET-SRV-01', asset_name: 'Office Server Pro Cluster', notes: 'UAT Main Production Cluster', purchase_cost: 800000, status: 'Active', purchase_date: new Date(), placed_in_service_date: new Date() },
      { company_id: companyId, category_id: catId, asset_code: 'ASSET-LAP-02', asset_name: 'Executive Laptop M3', notes: 'Accounting Team MacBook Pro', purchase_cost: 350000, status: 'Active', purchase_date: new Date(), placed_in_service_date: new Date() }
    ]);

    // 12. Seed Clients & Vendors
    const [v1] = await db('vendors').insert({ company_id: companyId, name: 'Apex Wholesale Corp', email: 'sales@apexwholesale.com' }).returning('id');
    const [v2] = await db('vendors').insert({ company_id: companyId, name: 'Titan Freight Services', email: 'logistics@titanfreight.com' }).returning('id');
    const v1Id = typeof v1 === 'object' ? v1.id : v1;
    const v2Id = typeof v2 === 'object' ? v2.id : v2;

    const [c1] = await db('clients').insert({ company_id: companyId, name: 'Prime Logistics Ltd', email: 'billing@primelogistics.com' }).returning('id');
    const [c2] = await db('clients').insert({ company_id: companyId, name: 'Starlight Tech Distributors', email: 'purchasing@starlighttech.com' }).returning('id');
    const c1Id = typeof c1 === 'object' ? c1.id : c1;
    const c2Id = typeof c2 === 'object' ? c2.id : c2;

    // 13. Seed Credit Risk relationship status
    await db('business_relationship_status').insert([
      { company_id: companyId, entity_type: 'VENDOR', entity_id: v1Id, status: 'WATCHLIST', risk_level: 'MEDIUM', risk_score: 45, notes: 'High credit exposure ratio, delayed invoice settlement.', cash_only: false },
      { company_id: companyId, entity_type: 'VENDOR', entity_id: v2Id, status: 'RESTRICTED', risk_level: 'HIGH', risk_score: 75, notes: 'Multiple late logistics shipments, pending compliance check.', cash_only: true },
      { company_id: companyId, entity_type: 'CUSTOMER', entity_id: c1Id, status: 'BLACKLISTED', risk_level: 'CRITICAL', risk_score: 95, notes: 'Consecutive payment default over 120 days. Placed under liquidation.', cash_only: true },
      { company_id: companyId, entity_type: 'CUSTOMER', entity_id: c2Id, status: 'ACTIVE', risk_level: 'LOW', risk_score: 15, notes: 'Perfect payment history, certified relationship.', cash_only: false }
    ]);

    res.json({ success: true, message: 'UAT Seeding Complete!' });
  } catch (err) {
    console.error('Seeding failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
