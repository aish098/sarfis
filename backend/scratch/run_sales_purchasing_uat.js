require('dotenv').config();
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function runUATPhase7() {
  console.log("=========================================================");
  console.log("             SARFIS ERP UAT - PHASE 7 SALES & PURCHASE  ");
  console.log("=========================================================");

  const functionalScoreboard = {};
  const performanceScoreboard = {};
  const evidence = [];

  let totalFunctional = 0;
  let passedFunctional = 0;
  let totalPerformance = 0;
  let passedPerformance = 0;

  function logFunctional(id, name, success, actual, details = "") {
    totalFunctional++;
    evidence.push({ id, type: 'Functional', scenario: name, expected: "PASS", actual: success ? "PASS" : "FAIL", details });
    if (success) {
      passedFunctional++;
      console.log(`✅ [PASS] ${id} - ${name} | ${actual}`);
      functionalScoreboard[id] = 'PASS';
    } else {
      console.error(`❌ [FAIL] ${id} - ${name} | Actual: ${actual} | Details: ${details}`);
      functionalScoreboard[id] = 'FAIL';
    }
  }

  function logPerformance(id, name, success, actual, details = "") {
    totalPerformance++;
    evidence.push({ id, type: 'Performance', scenario: name, expected: "PASS", actual: success ? "PASS" : "FAIL", details });
    if (success) {
      passedPerformance++;
      console.log(`⚡ [PASS] ${id} - ${name} | ${actual}`);
      performanceScoreboard[id] = 'PASS';
    } else {
      console.error(`⚡ [FAIL] ${id} - ${name} | Error: ${details}`);
      performanceScoreboard[id] = 'FAIL';
    }
  }

  let adminToken;
  let otherUserToken;

  try {
    const adminUser = await db('users')
      .join('user_roles', 'users.id', 'user_roles.user_id')
      .where('user_roles.company_id', 1)
      .select('users.id', 'users.email')
      .first();

    if (!adminUser) {
      throw new Error("No admin user found in database. Seed data first.");
    }

    adminToken = jwt.sign(
      { 
        id: adminUser.id, 
        email: adminUser.email, 
        role: 'Super Admin',
        permissions: [
          'vendor.manage', 'client.manage', 'voucher.create', 'voucher.edit',
          'voucher.post', 'voucher.view', 'inventory.view', 'inventory.edit',
          'report.view', 'journal.post', 'journal.create', 'journal.view'
        ]
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    otherUserToken = jwt.sign(
      { id: 99, email: 'other@sarfis.com', role: 'Employee', permissions: [] },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

  } catch (err) {
    console.error("- Setup authentication failed:", err.message);
    process.exit(1);
  }

  let vendorId;
  let clientId;
  let productId;
  let warehouseId;
  let purchaseVoucherId;
  let deliveryId;
  let salesVoucherId;
  let tempPurchaseVoucherId;

  try {
    // ---------------------------------------------------------
    // PRE-TEST CLEANUP & ENVIRONMENT PROVISIONING
    // ---------------------------------------------------------
    await db('delivery_items').delete();
    await db('deliveries').delete();
    await db('vouchers').delete();
    await db('stock_logs').delete();
    await db('inventory').delete();
    await db('vendors').delete();
    await db('clients').delete();
    await db('products').where('sku', 'STEEL001').delete();

    let taxPayableAcc = await db('accounts').where({ company_id: 1, code: '2200' }).first();
    if (!taxPayableAcc) {
      [taxPayableAcc] = await db('accounts').insert({
        company_id: 1,
        code: '2200',
        name: 'Sales Tax Payable',
        category: 'Liability',
        balance: 0
      }).returning('*');
    }
    let taxReceivableAcc = await db('accounts').where({ company_id: 1, code: '1400' }).first();
    if (!taxReceivableAcc) {
      [taxReceivableAcc] = await db('accounts').insert({
        company_id: 1,
        code: '1400',
        name: 'Sales Tax Receivable',
        category: 'Asset',
        balance: 0
      }).returning('*');
    }

    const PostingEngineService = require('../src/services/posting_engine.service');
    const settings = await PostingEngineService.getAccountingSettings(1);

    await db('company_accounting_settings')
      .where({ company_id: 1 })
      .update({
        default_tax_payable_account_id: taxPayableAcc.id,
        default_tax_receivable_account_id: taxReceivableAcc.id,
        tax_rate: 0.00
      });

    const warehouse = await db('warehouses').where({ company_id: 1 }).first();
    if (!warehouse) throw new Error("Please seed a warehouse for Company 1 first.");
    warehouseId = warehouse.id;

    const [prod] = await db('products').insert({
      company_id: 1,
      name: 'Steel Beam',
      sku: 'STEEL001',
      description: 'Construction grade steel beam',
      cost_price: 100.00,
      unit_price: 150.00,
      inventory_account_id: settings.default_inventory_account_id,
      cogs_account_id: settings.default_cogs_account_id,
      revenue_account_id: settings.default_sales_account_id
    }).returning('*');
    productId = prod.id;

    await db('inventory').insert({
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: 0.00
    });

    console.log("- UAT environment successfully prepared.");
  } catch (err) {
    console.error("- Preparation failed:", err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // UAT-701: Vendor Registration
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/vendors/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        name: 'Apex Metal Corp',
        email: 'apex@metal.com',
        phone: '123456',
        address: 'Karachi Industrial Zone'
      })
    });
    const data = await res.json();
    vendorId = data.id;

    if (res.status === 201 && vendorId && parseFloat(data.current_balance) === 0) {
      logFunctional('UAT-701', 'Vendor Registration', true, 'Vendor Apex Metal Corp successfully created with zero balance.');
    } else {
      logFunctional('UAT-701', 'Vendor Registration', false, `Status: ${res.status} | Balance: ${data?.current_balance}`);
    }
  } catch (err) {
    logFunctional('UAT-701', 'Vendor Registration', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-702: Purchase Requisition (Draft Voucher)
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/vouchers/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        type: 'PURCHASE',
        date: '2026-07-01',
        payload: {
          vendorId: vendorId,
          warehouseId: warehouseId,
          items: [
            { productId: productId, quantity: 100, unitCost: 100 }
          ]
        },
        totalAmount: 10000,
        taxAmount: 0
      })
    });
    const data = await res.json();
    purchaseVoucherId = data.id;

    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();

    if (res.status === 201 && data.status === 'DRAFT' && parseFloat(stock.quantity) === 0 && !data.journal_entry_id) {
      logFunctional('UAT-702', 'Purchase Requisition', true, 'Draft purchase voucher created with 0 stock and GL impact.');
    } else {
      logFunctional('UAT-702', 'Purchase Requisition', false, `Status: ${res.status} | Voucher Status: ${data?.status} | Qty: ${stock?.quantity} | JE: ${data?.journal_entry_id}`);
    }
  } catch (err) {
    logFunctional('UAT-702', 'Purchase Requisition', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-703: Purchase Order (Pending Approval)
  // ---------------------------------------------------------
  let workflowStageId;
  try {
    let def = await db('workflow_definitions').where({ company_id: 1, document_type_code: 'VOUCHER' }).first();
    if (!def) {
      let docType = await db('workflow_document_types').where({ code: 'VOUCHER' }).first();
      if (!docType) {
        [docType] = await db('workflow_document_types').insert({
          code: 'VOUCHER',
          name: 'Voucher Approval Workflow',
          callback_service: 'voucher.service',
          callback_method: 'postVoucher'
        }).returning('*');
      }
      [def] = await db('workflow_definitions').insert({
        company_id: 1,
        document_type_code: 'VOUCHER',
        name: 'Voucher Workflow',
        is_active: true
      }).returning('*');
    }

    const [stage] = await db('workflow_stages').insert({
      workflow_definition_id: def.id,
      stage_sequence: 1,
      name: 'Manager Approval Stage',
      required_role: 'Accountant',
      conditions: null
    }).returning('*');
    workflowStageId = stage.id;

    const res = await fetch(`${BASE_URL}/vouchers/1/${purchaseVoucherId}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();

    if (res.status === 200 && data.status === 'PENDING_APPROVAL' && parseFloat(stock.quantity) === 0) {
      logFunctional('UAT-703', 'Purchase Order', true, 'Voucher transitioned to PENDING_APPROVAL representing a PO (no stock impact).');
    } else {
      console.error("DEBUG UAT-703 FAILURE details:", res.status, data);
      logFunctional('UAT-703', 'Purchase Order', false, `Status: ${res.status} | Voucher Status: ${data?.status}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-703 ERROR:", err);
    logFunctional('UAT-703', 'Purchase Order', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-704: Goods Receipt & Purchase Invoice (Post Voucher)
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/vouchers/1/${purchaseVoucherId}/post`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    if (workflowStageId) {
      await db('workflow_stages').where({ id: workflowStageId }).delete();
    }

    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();
    const vendor = await db('vendors').where({ id: vendorId }).first();
    const product = await db('products').where({ id: productId }).first();

    if (res.status === 200 && data.status === 'POSTED' && parseFloat(stock.quantity) === 100 && parseFloat(vendor.current_balance) === 10000 && parseFloat(product.cost_price) === 100) {
      logFunctional('UAT-704', 'Goods Receipt & Purchase Invoice', true, 'Posted purchase voucher correctly: updated stock (+100), vendor balance (+10000), and re-computed WAC.');
    } else {
      console.error("DEBUG UAT-704 FAILURE details:", res.status, data);
      logFunctional('UAT-704', 'Goods Receipt & Purchase Invoice', false, `Status: ${res.status} | Stock Qty: ${stock?.quantity} | Vendor Bal: ${vendor?.current_balance} | Cost: ${product?.cost_price}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-704 ERROR:", err);
    logFunctional('UAT-704', 'Goods Receipt & Purchase Invoice', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-705: AP Aging
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/reports/ap-aging/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const entry = data.find(v => v.vendorId === vendorId);
    const hasBucket = entry && parseFloat(entry.buckets['0-30']) === 10000;

    if (res.status === 200 && hasBucket) {
      logFunctional('UAT-705', 'AP Aging', true, 'Vendor aging report generated with outstanding amount in 0-30 bucket.');
    } else {
      logFunctional('UAT-705', 'AP Aging', false, `Status: ${res.status} | Aging Buckets: ${JSON.stringify(entry?.buckets)}`);
    }
  } catch (err) {
    logFunctional('UAT-705', 'AP Aging', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-706: Vendor Statement
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/reports/vendor-statement/1/${vendorId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const hasStatementRow = data.statement && data.statement.length === 1 && data.statement[0].type === 'PURCHASE' && parseFloat(data.statement[0].runningBalance) === 10000;

    if (res.status === 200 && hasStatementRow) {
      logFunctional('UAT-706', 'Vendor Statement', true, 'Vendor chronological statement generated showing purchases and correct running balance.');
    } else {
      logFunctional('UAT-706', 'Vendor Statement', false, `Status: ${res.status} | Rows: ${data.statement?.length}`);
    }
  } catch (err) {
    logFunctional('UAT-706', 'Vendor Statement', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-707: Customer Creation
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/clients/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        name: 'Alpha Logistics',
        email: 'alpha@logistics.com',
        phone: '654321',
        address: 'Lahore Highway',
        credit_limit: 50000.00
      })
    });
    const data = await res.json();
    clientId = data.id;

    if (res.status === 201 && clientId && parseFloat(data.current_balance) === 0 && parseFloat(data.credit_limit) === 50000) {
      logFunctional('UAT-707', 'Customer Creation', true, 'Customer Alpha Logistics created with credit limit PKR 50,000.');
    } else {
      logFunctional('UAT-707', 'Customer Creation', false, `Status: ${res.status} | Balance: ${data?.current_balance} | Credit: ${data?.credit_limit}`);
    }
  } catch (err) {
    logFunctional('UAT-707', 'Customer Creation', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-708: Sales Quotation & Sales Order (Pending Delivery)
  // ---------------------------------------------------------
  try {
    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();

    const res = await fetch(`${BASE_URL}/deliveries/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        clientId: clientId,
        warehouseId: warehouseId,
        items: [
          { product_id: productId, quantity: 10, unit_price: 150.00, unit_cost: 100.00 }
        ],
        notes: 'Sales Order #SO-001',
        arAccountId: settings.default_ar_account_id,
        deliveryDate: '2026-07-05'
      })
    });
    const data = await res.json();
    deliveryId = data.id;

    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();

    if (res.status === 201 && data.status === 'PENDING' && parseFloat(stock.quantity) === 100) {
      logFunctional('UAT-708', 'Sales Quotation & Sales Order', true, 'Created PENDING Delivery note representing Sales Order (no stock or balance impact).');
    } else {
      logFunctional('UAT-708', 'Sales Quotation & Sales Order', false, `Status: ${res.status} | Delivery Status: ${data?.status} | Qty: ${stock?.quantity}`);
    }
  } catch (err) {
    logFunctional('UAT-708', 'Sales Quotation & Sales Order', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-709: Delivery Note Confirmation
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/deliveries/1/${deliveryId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({ status: 'CONFIRMED' })
    });
    const data = await res.json();

    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();
    const client = await db('clients').where({ id: clientId }).first();

    if (res.status === 200 && parseFloat(stock.quantity) === 90 && parseFloat(client.current_balance) === 1500) {
      logFunctional('UAT-709', 'Delivery Note Confirmation', true, 'Confirmed delivery order: deducted stock (-10), updated customer AR balance (+1500), and posted COGS.');
    } else {
      console.error("DEBUG UAT-709 FAILURE details:", res.status, data);
      logFunctional('UAT-709', 'Delivery Note Confirmation', false, `Status: ${res.status} | Stock Qty: ${stock?.quantity} | Customer Bal: ${client?.current_balance}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-709 ERROR:", err);
    logFunctional('UAT-709', 'Delivery Note Confirmation', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-710: Customer Payment (RECEIPT Voucher)
  // ---------------------------------------------------------
  try {
    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();

    const resDraft = await fetch(`${BASE_URL}/vouchers/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        type: 'RECEIPT',
        date: '2026-07-06',
        payload: {
          clientId: clientId,
          cashAccountId: settings.default_cash_account_id,
          amount: 1000.00
        },
        totalAmount: 1000.00,
        taxAmount: 0
      })
    });
    const draftData = await resDraft.json();
    const receiptVoucherId = draftData.id;

    const resPost = await fetch(`${BASE_URL}/vouchers/1/${receiptVoucherId}/post`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const postData = await resPost.json();
    
    const client = await db('clients').where({ id: clientId }).first();

    if (resPost.status === 200 && parseFloat(client.current_balance) === 500) {
      logFunctional('UAT-710', 'Customer Payment', true, 'Posted payment RECEIPT: customer balance reduced to 500 PKR.');
    } else {
      console.error("DEBUG UAT-710 FAILURE details:", resPost.status, postData);
      logFunctional('UAT-710', 'Customer Payment', false, `Status: ${resPost.status} | Customer Bal: ${client?.current_balance}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-710 ERROR:", err);
    logFunctional('UAT-710', 'Customer Payment', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-711: AR Aging
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/reports/ar-aging/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const entry = data.find(c => c.clientId === clientId);
    const hasBucket = entry && parseFloat(entry.buckets['0-30']) === 500;

    if (res.status === 200 && hasBucket) {
      logFunctional('UAT-711', 'AR Aging', true, 'Customer aging report generated with outstanding amount of 500 PKR in 0-30 bucket.');
    } else {
      console.error("DEBUG UAT-711 FAILURE details:", res.status, data);
      logFunctional('UAT-711', 'AR Aging', false, `Status: ${res.status} | Aging Buckets: ${JSON.stringify(entry?.buckets)}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-711 ERROR:", err);
    logFunctional('UAT-711', 'AR Aging', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-712: Customer Statement
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/reports/customer-statement/1/${clientId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const hasInvoicesAndReceipts = data.statement && data.statement.length === 2 && 
      data.statement[0].type === 'DELIVERY' && parseFloat(data.statement[0].runningBalance) === 1500 &&
      data.statement[1].type === 'RECEIPT' && parseFloat(data.statement[1].runningBalance) === 500;

    if (res.status === 200 && hasInvoicesAndReceipts) {
      logFunctional('UAT-712', 'Customer Statement', true, 'Customer statement generated showing sales delivery, receipt, and running balance.');
    } else {
      console.error("DEBUG UAT-712 FAILURE details:", res.status, data);
      logFunctional('UAT-712', 'Customer Statement', false, `Status: ${res.status} | Rows: ${data.statement?.length}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-712 ERROR:", err);
    logFunctional('UAT-712', 'Customer Statement', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-713: VAT / Sales Tax Accrual
  // ---------------------------------------------------------
  try {
    await db('company_accounting_settings')
      .where({ company_id: 1 })
      .update({ tax_rate: 18.00 });

    const resDraft = await fetch(`${BASE_URL}/vouchers/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        type: 'SALES',
        date: '2026-07-08',
        payload: {
          clientId: clientId,
          warehouseId: warehouseId,
          items: [
            { productId: productId, quantity: 10, unitPrice: 200.00 }
          ]
        },
        totalAmount: 2000.00,
        taxAmount: 360.00
      })
    });
    const draftData = await resDraft.json();
    salesVoucherId = draftData.id;

    const resPost = await fetch(`${BASE_URL}/vouchers/1/${salesVoucherId}/post`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const postData = await resPost.json();

    const client = await db('clients').where({ id: clientId }).first();

    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();
    const taxPayableLine = await db('journal_lines')
      .where({ entry_id: postData.journal_entry_id, account_id: settings.default_tax_payable_account_id })
      .first();

    const isTaxAccrued = taxPayableLine && parseFloat(taxPayableLine.credit) === 360.00;

    if (resPost.status === 200 && isTaxAccrued && parseFloat(client.current_balance) === 2860) {
      logFunctional('UAT-713', 'VAT / Sales Tax Accrual', true, 'Posted sales voucher with 18% VAT: Output tax payable accrued (360 PKR) and gross AR updated (+2360 PKR).');
    } else {
      logFunctional('UAT-713', 'VAT / Sales Tax Accrual', false, `Status: ${resPost.status} | Tax Line Credit: ${taxPayableLine?.credit} | Customer Bal: ${client?.current_balance}`);
    }
  } catch (err) {
    logFunctional('UAT-713', 'VAT / Sales Tax Accrual', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-714: Credit Policy Enforcement
  // ---------------------------------------------------------
  try {
    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();

    const res = await fetch(`${BASE_URL}/deliveries/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        clientId: clientId,
        warehouseId: warehouseId,
        items: [
          { product_id: productId, quantity: 400, unit_price: 150.00, unit_cost: 100.00 }
        ],
        notes: 'Sales Order exceeding credit limit',
        arAccountId: settings.default_ar_account_id
      })
    });
    const data = await res.json();

    const isBlocked = res.status === 400 && data.error && data.error.includes("Credit limit exceeded");

    if (isBlocked) {
      logFunctional('UAT-714', 'Credit Policy Enforcement', true, 'Sales order exceeding limit was successfully blocked by risk policy.');
    } else {
      console.error("DEBUG UAT-714 FAILURE details:", res.status, data);
      logFunctional('UAT-714', 'Credit Policy Enforcement', false, `Status: ${res.status} | Response: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-714 ERROR:", err);
    logFunctional('UAT-714', 'Credit Policy Enforcement', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-717: Partial Customer Payment
  // ---------------------------------------------------------
  try {
    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();

    const resDraft = await fetch(`${BASE_URL}/vouchers/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        type: 'RECEIPT',
        date: '2026-07-09',
        payload: {
          clientId: clientId,
          cashAccountId: settings.default_cash_account_id,
          amount: 1000.00
        },
        totalAmount: 1000.00,
        taxAmount: 0
      })
    });
    const draftData = await resDraft.json();

    const resPost = await fetch(`${BASE_URL}/vouchers/1/${draftData.id}/post`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });

    const client = await db('clients').where({ id: clientId }).first();

    if (resPost.status === 200 && parseFloat(client.current_balance) === 1860) {
      logFunctional('UAT-717', 'Partial Customer Payment', true, 'Partial payment applied successfully: customer balance is now 1860 PKR.');
    } else {
      logFunctional('UAT-717', 'Partial Customer Payment', false, `Status: ${resPost.status} | Balance: ${client?.current_balance}`);
    }
  } catch (err) {
    logFunctional('UAT-717', 'Partial Customer Payment', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-718: Vendor Payment
  // ---------------------------------------------------------
  try {
    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();

    const resDraft = await fetch(`${BASE_URL}/vouchers/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        type: 'PAYMENT',
        date: '2026-07-09',
        payload: {
          vendorId: vendorId,
          cashAccountId: settings.default_cash_account_id,
          amount: 5000.00
        },
        totalAmount: 5000.00,
        taxAmount: 0
      })
    });
    const draftData = await resDraft.json();

    const resPost = await fetch(`${BASE_URL}/vouchers/1/${draftData.id}/post`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });

    const vendor = await db('vendors').where({ id: vendorId }).first();

    if (resPost.status === 200 && parseFloat(vendor.current_balance) === 5000) {
      logFunctional('UAT-718', 'Vendor Payment', true, 'Posted supplier PAYMENT: vendor outstanding reduced to 5000 PKR.');
    } else {
      logFunctional('UAT-718', 'Vendor Payment', false, `Status: ${resPost.status} | Balance: ${vendor?.current_balance}`);
    }
  } catch (err) {
    logFunctional('UAT-718', 'Vendor Payment', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-719: Sales Return
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/vouchers/1/${salesVoucherId}/reverse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const client = await db('clients').where({ id: clientId }).first();
    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();

    const reversedOk = res.status === 200 && parseFloat(client.current_balance) === -500 && parseFloat(stock.quantity) === 90;

    if (reversedOk) {
      logFunctional('UAT-719', 'Sales Return', true, 'Sales return reversed correctly: client balance reduced by 2360 PKR and inventory restored (+10).');
    } else {
      console.error("DEBUG UAT-719 FAILURE details:", res.status, data);
      logFunctional('UAT-719', 'Sales Return', false, `Status: ${res.status} | Client Bal: ${client?.current_balance} | Stock: ${stock?.quantity}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-719 ERROR:", err);
    logFunctional('UAT-719', 'Sales Return', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-720: Purchase Return
  // ---------------------------------------------------------
  try {
    // 1. Post a temporary purchase voucher of 20 Steel Beams to provide enough stock
    const resTempDraft = await fetch(`${BASE_URL}/vouchers/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        type: 'PURCHASE',
        date: '2026-07-09',
        payload: {
          vendorId: vendorId,
          warehouseId: warehouseId,
          items: [
            { productId: productId, quantity: 20, unitCost: 100 }
          ]
        },
        totalAmount: 2000,
        taxAmount: 0
      })
    });
    const tempDraft = await resTempDraft.json();
    tempPurchaseVoucherId = tempDraft.id;
    await fetch(`${BASE_URL}/vouchers/1/${tempDraft.id}/post`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });

    // 2. Now reverse the original 100-qty purchase voucher
    const res = await fetch(`${BASE_URL}/vouchers/1/${purchaseVoucherId}/reverse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const vendor = await db('vendors').where({ id: vendorId }).first();
    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();

    const reversedOk = res.status === 200 && parseFloat(vendor.current_balance) === -2640 && parseFloat(stock.quantity) === 10;

    if (reversedOk) {
      logFunctional('UAT-720', 'Purchase Return', true, 'Purchase return reversed correctly: vendor AP balance reduced by 10000 PKR and inventory deducted (-100).');
    } else {
      console.error("DEBUG UAT-720 FAILURE details:", res.status, data);
      logFunctional('UAT-720', 'Purchase Return', false, `Status: ${res.status} | Vendor Bal: ${vendor?.current_balance} | Stock: ${stock?.quantity}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-720 ERROR:", err);
    logFunctional('UAT-720', 'Purchase Return', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-715: Trial Balance Integrity
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/reports/trial-balance/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const trialBalance = await res.json();

    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of trialBalance) {
      totalDebit += parseFloat(row.total_debit || 0);
      totalCredit += parseFloat(row.total_credit || 0);
    }

    const isBalanced = Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();
    
    // Audit GL change vs Valuation change for STEEL001
    const entryIds = [];
    const pv = await db('vouchers').where({ id: purchaseVoucherId }).first();
    if (pv && pv.journal_entry_id) entryIds.push(pv.journal_entry_id);
    const sv = await db('vouchers').where({ id: salesVoucherId }).first();
    if (sv && sv.journal_entry_id) entryIds.push(sv.journal_entry_id);
    const del = await db('deliveries').where({ id: deliveryId }).first();
    if (del && del.journal_entry_id) entryIds.push(del.journal_entry_id);
    if (tempPurchaseVoucherId) {
      const tv = await db('vouchers').where({ id: tempPurchaseVoucherId }).first();
      if (tv && tv.journal_entry_id) entryIds.push(tv.journal_entry_id);
    }

    const reversals = await db('vouchers')
      .whereIn('id', [purchaseVoucherId, salesVoucherId])
      .whereNotNull('reversal_voucher_id');
    for (const r of reversals) {
      const revV = await db('vouchers').where({ id: r.reversal_voucher_id }).first();
      if (revV && revV.journal_entry_id) {
        entryIds.push(revV.journal_entry_id);
      }
    }

    const lines = await db('journal_lines')
      .whereIn('entry_id', entryIds)
      .where('account_id', settings.default_inventory_account_id);

    let netGLChange = 0;
    for (const l of lines) {
      netGLChange += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
    }

    const stock = await db('inventory').where({ product_id: productId, warehouse_id: warehouseId }).first();
    const currentValuation = parseFloat(stock?.quantity || 0) * 100.00;

    const isReconciled = Math.abs(netGLChange - currentValuation) < 1.00;

    if (res.status === 200 && isBalanced && isReconciled) {
      logFunctional('UAT-715', 'Trial Balance Integrity', true, `Trial balance reconciles perfectly. Debits (${totalDebit.toFixed(2)}) == Credits (${totalCredit.toFixed(2)}). Inventory GL (${netGLChange.toFixed(2)}) reconciles with Valuation (${currentValuation.toFixed(2)}).`);
    } else {
      console.error("DEBUG UAT-715 FAILURE details:", res.status, "GL Change:", netGLChange, "Valuation:", currentValuation, "Balanced:", isBalanced);
      logFunctional('UAT-715', 'Trial Balance Integrity', false, `Status: ${res.status} | Balanced: ${isBalanced} | Reconciled: ${isReconciled} | GL Change: ${netGLChange} | Valuation: ${currentValuation}`);
    }
  } catch (err) {
    console.error("DEBUG UAT-715 ERROR:", err);
    logFunctional('UAT-715', 'Trial Balance Integrity', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-716: Performance SLA (AP/AR Aging)
  // ---------------------------------------------------------
  try {
    const t0 = performance.now();
    const resAP = await fetch(`${BASE_URL}/reports/ap-aging/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const resAR = await fetch(`${BASE_URL}/reports/ar-aging/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const t1 = performance.now();
    const duration = t1 - t0;

    if (resAP.status === 200 && resAR.status === 200 && duration < 300) {
      logPerformance('UAT-716', 'Aging Fetch Response SLA', true, `${duration.toFixed(2)}ms (SLA: <300ms)`);
    } else {
      logPerformance('UAT-716', 'Aging Fetch Response SLA', false, `Duration: ${duration.toFixed(2)}ms | AP Status: ${resAP.status} | AR Status: ${resAR.status}`);
    }
  } catch (err) {
    logPerformance('UAT-716', 'Aging Fetch Response SLA', false, 'Execution failed', err.message);
  }

  console.log("\n=========================================================");
  console.log("                UAT PHASE 7 SCOREBOARD                   ");
  console.log("=========================================================");
  console.log("FUNCTIONAL UAT:");
  Object.entries(functionalScoreboard).forEach(([id, status]) => {
    console.log(`${id.padEnd(10)}: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  });
  console.log("\nPERFORMANCE UAT:");
  Object.entries(performanceScoreboard).forEach(([id, status]) => {
    console.log(`${id.padEnd(10)}: ${status === 'PASS' ? '⚡ PASS' : '❌ FAIL'}`);
  });

  const finalFunctionalPercent = Math.round((passedFunctional / totalFunctional) * 100);
  console.log("---------------------------------------------------------");
  console.log(`FUNCTIONAL PASS RATE  : ${finalFunctionalPercent}%`);
  console.log("=========================================================");

  await db('company_accounting_settings')
    .where({ company_id: 1 })
    .update({ tax_rate: 0.00 });

  if (passedFunctional === totalFunctional && passedPerformance === totalPerformance) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runUATPhase7();
