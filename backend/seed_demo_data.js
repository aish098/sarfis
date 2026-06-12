const db = require('./src/config/db');
const PostingEngineService = require('./src/services/posting_engine.service');
const VoucherService = require('./src/services/voucher.service');
const VendorModel = require('./src/models/vendor.model');
const AccountModel = require('./src/models/account.model');

async function seedData() {
  console.log('Seeding Demo Data for the most recent company...');
  
  try {
    const company = await db('companies').orderBy('id', 'desc').first();
    if (!company) throw new Error('No company found.');
    console.log(`Using Company: ${company.name} (ID: ${company.id})`);

    const user = await db('users').where({ id: company.owner_id }).first();
    if (!user) throw new Error('No owner found.');

    console.log('Clearing old demo data for company...');
    await db('journal_entries').where({ company_id: company.id }).delete();
    await db('vouchers').where({ company_id: company.id }).delete();
    // Delete stock logs and inventory to satisfy FK constraints for products
    const companyProducts = await db('products').where({ company_id: company.id }).select('id');
    const productIds = companyProducts.map(p => p.id);
    if (productIds.length > 0) {
      await db('stock_logs').whereIn('product_id', productIds).delete();
      await db('inventory').whereIn('product_id', productIds).delete();
    }
    await db('products').where({ company_id: company.id }).delete();
    await db('clients').where({ company_id: company.id }).delete();
    await db('vendors').where({ company_id: company.id }).delete();
    await db('warehouses').where({ company_id: company.id }).delete();

    // 1. Warehouse
    const [warehouse] = await db('warehouses').insert({
      company_id: company.id,
      name: 'Main Distribution Center',
      location: 'New York, NY',
      is_active: true
    }).returning('*');

    // 2. Vendors
    const vendor1 = await VendorModel.create({
      companyId: company.id, name: 'Tech Supplies Co.', email: 'sales@techsupplies.com', phone: '555-0100'
    });
    const vendor2 = await VendorModel.create({
      companyId: company.id, name: 'Global Manufacturing Inc.', email: 'orders@globalmfg.com', phone: '555-0101'
    });

    // 3. Clients
    const [client1] = await db('clients').insert({ company_id: company.id, name: 'Acme Corp', credit_limit: 50000 }).returning('*');
    const [client2] = await db('clients').insert({ company_id: company.id, name: 'Stark Industries', credit_limit: 250000 }).returning('*');

    // 4. Products
    const accounts = await db('accounts').where({ company_id: company.id });
    const invAcc = accounts.find(a => a.code === '1300');
    const cogsAcc = accounts.find(a => a.code === '5010');
    const revAcc = accounts.find(a => a.code === '4010');

    const [prod1] = await db('products').insert({
      company_id: company.id, sku: 'LAP-PRO-01', name: 'MacBook Pro 16"',
      unit_price: 2500.00, cost_price: 1800.00, unit_of_measure: 'unit',
      inventory_account_id: invAcc.id, cogs_account_id: cogsAcc.id, revenue_account_id: revAcc.id
    }).returning('*');

    const [prod2] = await db('products').insert({
      company_id: company.id, sku: 'MON-4K-02', name: 'Dell 4K Monitor',
      unit_price: 600.00, cost_price: 350.00, unit_of_measure: 'unit',
      inventory_account_id: invAcc.id, cogs_account_id: cogsAcc.id, revenue_account_id: revAcc.id
    }).returning('*');

    // 5. Purchase Vouchers (Buy Inventory)
    console.log('Posting Purchases...');
    const pur1 = await VoucherService.createDraft({
      companyId: company.id, type: 'PURCHASE', userId: user.id,
      totalAmount: 1800 * 50,
      payload: {
        vendorId: vendor1.id, warehouseId: warehouse.id, notes: 'Initial stock of Laptops',
        items: [{ productId: prod1.id, quantity: 50, unitCost: 1800 }]
      }
    });
    await VoucherService.postToLedger(pur1.id, company.id, user.id);

    const pur2 = await VoucherService.createDraft({
      companyId: company.id, type: 'PURCHASE', userId: user.id,
      totalAmount: 350 * 100,
      payload: {
        vendorId: vendor2.id, warehouseId: warehouse.id, notes: 'Initial stock of Monitors',
        items: [{ productId: prod2.id, quantity: 100, unitCost: 350 }]
      }
    });
    await VoucherService.postToLedger(pur2.id, company.id, user.id);

    // 6. Sales Vouchers (Sell Inventory)
    console.log('Posting Sales...');
    const sale1 = await VoucherService.createDraft({
      companyId: company.id, type: 'SALES', userId: user.id,
      totalAmount: 2500 * 5 + 600 * 10,
      payload: {
        clientId: client1.id, warehouseId: warehouse.id, notes: 'Office upgrade for Acme',
        items: [
          { productId: prod1.id, quantity: 5, unitPrice: 2500 },
          { productId: prod2.id, quantity: 10, unitPrice: 600 }
        ]
      }
    });
    await VoucherService.postToLedger(sale1.id, company.id, user.id);

    const sale2 = await VoucherService.createDraft({
      companyId: company.id, type: 'SALES', userId: user.id,
      totalAmount: 2500 * 20,
      payload: {
        clientId: client2.id, warehouseId: warehouse.id, notes: 'Bulk laptop purchase for Stark',
        items: [{ productId: prod1.id, quantity: 20, unitPrice: 2500 }]
      }
    });
    await VoucherService.postToLedger(sale2.id, company.id, user.id);

    // 7. Manual Journal Entries
    console.log('Posting Manual Journals...');
    const cashAcc = accounts.find(a => a.code === '1010');
    const capitalAcc = accounts.find(a => a.code === '3010');
    
    if (cashAcc && capitalAcc) {
      const journalEntry = await db('journal_entries').insert({
        company_id: company.id, description: 'Initial Owner Investment', created_by: user.id, entry_date: new Date()
      }).returning('*');
      
      await db('journal_lines').insert([
        { entry_id: journalEntry[0].id, account_id: cashAcc.id, debit: 500000, credit: 0 },
        { entry_id: journalEntry[0].id, account_id: capitalAcc.id, debit: 0, credit: 500000 }
      ]);
      
      await db('accounts').where({ id: cashAcc.id }).increment('balance', 500000);
      await db('accounts').where({ id: capitalAcc.id }).increment('balance', 500000);
    }

    console.log('✅ Demo Data Seeded Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seedData();
