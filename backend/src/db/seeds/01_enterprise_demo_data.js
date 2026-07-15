const { hashPassword } = require('../../src/utils/auth.utils');

const COMPANY_ID = 'd2a04476-c035-4b2c-b56e-a4a5ebb9b369';
const USER_ID = 'a2a04476-c035-4b2c-b56e-a4a5ebb9b369';

// --- Main Seeding Function ---
exports.seed = async function (knex) {
  // 1. Clean Slate: Delete existing data in reverse order of creation
  await knex('journal_lines').del();
  await knex('journal_entries').del();
  await knex('deliveries').del();
  await knex('purchases').del();
  await knex('expenses').del();
  await knex('products').del();
  await knex('warehouses').del();
  await knex('clients').del();
  await knex('vendors').del();
  await knex('accounts').del();
  await knex('users').where('id', USER_ID).del();
  await knex('companies').where('id', COMPANY_ID).del();

  // 2. Core Setup: Create Company and User
  await knex('companies').insert({ id: COMPANY_ID, name: 'ACCOUNTELLENCE Enterprise' });
  const hashedPassword = await hashPassword('password');
  await knex('users').insert({
    id: USER_ID,
    company_id: COMPANY_ID,
    email: 'admin@accountellence.com',
    password: hashedPassword,
    name: 'Admin User',
    role: 'ADMIN'
  });

  // 3. Accounting Foundation: Chart of Accounts
  const accounts = await createChartOfAccounts(knex);

  // 4. Operational Entities
  await createWarehouses(knex);
  await createVendors(knex);
  await createClients(knex);
  await createProducts(knex);

  // 5. Simulate One Year of Business Activity
  await simulateYear(knex, accounts);

  console.log('✅ Enterprise demo data seeded successfully!');
};

// --- Helper Functions ---

async function createChartOfAccounts(knex) {
  const accountData = [
    // Assets
    { name: 'Cash', type: 'ASSET', sub_type: 'CURRENT', code: '1010', is_system: true },
    { name: 'Petty Cash', type: 'ASSET', sub_type: 'CURRENT', code: '1020' },
    { name: 'Main Bank Account', type: 'ASSET', sub_type: 'CURRENT', code: '1030', is_system: true },
    { name: 'Accounts Receivable', type: 'ASSET', sub_type: 'CURRENT', code: '1200', is_system: true },
    { name: 'Inventory', type: 'ASSET', sub_type: 'CURRENT', code: '1300', is_system: true },
    { name: 'Prepaid Expenses', type: 'ASSET', sub_type: 'CURRENT', code: '1400' },
    { name: 'Machinery & Equipment', type: 'ASSET', sub_type: 'NON_CURRENT', code: '1500' },
    { name: 'Accumulated Depreciation', type: 'ASSET', sub_type: 'NON_CURRENT', code: '1599' },

    // Liabilities
    { name: 'Accounts Payable', type: 'LIABILITY', sub_type: 'CURRENT', code: '2010', is_system: true },
    { name: 'Salaries Payable', type: 'LIABILITY', sub_type: 'CURRENT', code: '2100' },
    { name: 'Sales Tax Payable', type: 'LIABILITY', sub_type: 'CURRENT', code: '2200' },
    { name: 'Bank Loan', type: 'LIABILITY', sub_type: 'NON_CURRENT', code: '2500' },

    // Equity
    { name: 'Owner\'s Capital', type: 'EQUITY', sub_type: 'EQUITY', code: '3010' },
    { name: 'Retained Earnings', type: 'EQUITY', sub_type: 'EQUITY', code: '3200', is_system: true },

    // Revenue
    { name: 'Sales Revenue', type: 'REVENUE', sub_type: 'REVENUE', code: '4010', is_system: true },
    { name: 'Service Revenue', type: 'REVENUE', sub_type: 'REVENUE', code: '4020' },

    // Expenses
    { name: 'Cost of Goods Sold', type: 'EXPENSE', sub_type: 'COGS', code: '5010', is_system: true },
    { name: 'Salaries and Wages', type: 'EXPENSE', sub_type: 'OPERATING', code: '6010' },
    { name: 'Rent Expense', type: 'EXPENSE', sub_type: 'OPERATING', code: '6020' },
    { name: 'Utilities Expense', type: 'EXPENSE', sub_type: 'OPERATING', code: '6030' },
    { name: 'Marketing Expense', type: 'EXPENSE', sub_type: 'OPERATING', code: '6040' },
    { name: 'Office Supplies', type: 'EXPENSE', sub_type: 'OPERATING', code: '6050' },
    { name: 'Depreciation Expense', type: 'EXPENSE', sub_type: 'OPERATING', code: '6060' },
  ];

  await knex('accounts').insert(accountData.map(acc => ({ ...acc, company_id: COMPANY_ID })));

  const insertedAccounts = await knex('accounts').where('company_id', COMPANY_ID);
  return insertedAccounts.reduce((acc, current) => {
    acc[current.name.replace(/ /g, '')] = current.id;
    return acc;
  }, {});
}

async function createWarehouses(knex) {
  await knex('warehouses').insert([
    { company_id: COMPANY_ID, name: 'Main Warehouse', location: 'Karachi' },
    { company_id: COMPANY_ID, name: 'North Distribution Center', location: 'Lahore' },
  ]);
}

async function createVendors(knex) {
  await knex('vendors').insert([
    { company_id: COMPANY_ID, name: 'Global Tech Supplies', email: 'sales@globaltech.com' },
    { company_id: COMPANY_ID, name: 'Office Essentials Co.', email: 'contact@officeessentials.com' },
  ]);
}

async function createClients(knex) {
  await knex('clients').insert([
    { company_id: COMPANY_ID, name: 'Innovate Corp', email: 'purchasing@innovate.com' },
    { company_id: COMPANY_ID, name: 'Solutions Ltd.', email: 'accounts@solutions.com' },
  ]);
}

async function createProducts(knex) {
  await knex('products').insert([
    { company_id: COMPANY_ID, name: 'Laptop Pro 15"', sku: 'LP15', price: 120000, cost: 95000 },
    { company_id: COMPANY_ID, name: 'Wireless Mouse', sku: 'WM01', price: 2500, cost: 1500 },
    { company_id: COMPANY_ID, name: 'Mechanical Keyboard', sku: 'MK02', price: 8000, cost: 5500 },
  ]);
}

async function simulateYear(knex, accounts) {
  const today = new Date();
  for (let month = 11; month >= 0; month--) {
    const date = new Date(today.getFullYear(), today.getMonth() - month, 15);
    const description = date.toLocaleString('default', { month: 'long', year: 'year' });

    // --- Monthly Transactions ---
    // 1. Pay Salaries
    await createJournalEntry(knex, {
      date,
      description: `Salaries for ${description}`,
      lines: [
        { account_id: accounts.SalariesandWages, type: 'DEBIT', amount: 250000 },
        { account_id: accounts.MainBankAccount, type: 'CREDIT', amount: 250000 },
      ]
    });

    // 2. Pay Rent
    await createJournalEntry(knex, {
      date,
      description: `Rent for ${description}`,
      lines: [
        { account_id: accounts.RentExpense, type: 'DEBIT', amount: 120000 },
        { account_id: accounts.MainBankAccount, type: 'CREDIT', amount: 120000 },
      ]
    });

    // 3. Purchase Inventory
    const products = await knex('products').where('company_id', COMPANY_ID);
    const vendors = await knex('vendors').where('company_id', COMPANY_ID);
    const purchaseAmount = (products[0].cost * 5) + (products[1].cost * 10);
    await knex('purchases').insert({
      company_id: COMPANY_ID,
      vendor_id: vendors[0].id,
      date,
      total: purchaseAmount,
      items: JSON.stringify([
        { product_id: products[0].id, quantity: 5, cost: products[0].cost },
        { product_id: products[1].id, quantity: 10, cost: products[1].cost },
      ])
    });
    await createJournalEntry(knex, {
      date,
      description: `Inventory Purchase from ${vendors[0].name}`,
      lines: [
        { account_id: accounts.Inventory, type: 'DEBIT', amount: purchaseAmount },
        { account_id: accounts.AccountsPayable, type: 'CREDIT', amount: purchaseAmount },
      ]
    });

    // 4. Sell Products
    const clients = await knex('clients').where('company_id', COMPANY_ID);
    const saleAmount = (products[0].price * 3) + (products[1].price * 5);
    const cogsAmount = (products[0].cost * 3) + (products[1].cost * 5);
    await knex('deliveries').insert({
      company_id: COMPANY_ID,
      client_id: clients[0].id,
      date,
      total: saleAmount,
      items: JSON.stringify([
        { product_id: products[0].id, quantity: 3, price: products[0].price },
        { product_id: products[1].id, quantity: 5, price: products[1].price },
      ])
    });
    // Journal for Sale
    await createJournalEntry(knex, {
      date,
      description: `Sale to ${clients[0].name}`,
      lines: [
        { account_id: accounts.AccountsReceivable, type: 'DEBIT', amount: saleAmount },
        { account_id: accounts.SalesRevenue, type: 'CREDIT', amount: saleAmount },
      ]
    });
    // Journal for COGS
    await createJournalEntry(knex, {
      date,
      description: `COGS for sale to ${clients[0].name}`,
      lines: [
        { account_id: accounts.CostofGoodsSold, type: 'DEBIT', amount: cogsAmount },
        { account_id: accounts.Inventory, type: 'CREDIT', amount: cogsAmount },
      ]
    });
  }
}

async function createJournalEntry(knex, { date, description, lines }) {
  const [entry] = await knex('journal_entries')
    .insert({
      company_id: COMPANY_ID,
      date,
      description,
      status: 'POSTED'
    })
    .returning('id');

  const lineItems = lines.map(line => ({
    ...line,
    journal_id: entry.id,
  }));

  await knex('journal_lines').insert(lineItems);
}