const db = require('../config/db');

class SubledgerService {
  static async getReceivablesSubledger(companyId) {
    const clients = await db('clients').where({ company_id: companyId }).orderBy('name', 'asc');
    
    // Sum of posted SALES vouchers
    const salesSums = await db('vouchers')
      .where({ company_id: companyId, type: 'SALES', status: 'POSTED', is_reversed: false, deleted_at: null })
      .select(db.raw("(payload->>'clientId')::int as client_id"))
      .sum('total_amount as total')
      .groupByRaw("(payload->>'clientId')::int");

    // Sum of posted RECEIPT vouchers
    const receiptSums = await db('vouchers')
      .where({ company_id: companyId, type: 'RECEIPT', status: 'POSTED', is_reversed: false, deleted_at: null })
      .select(db.raw("(payload->>'clientId')::int as client_id"))
      .sum('total_amount as total')
      .groupByRaw("(payload->>'clientId')::int");

    const salesMap = {};
    salesSums.forEach(s => { if (s.client_id) salesMap[s.client_id] = parseFloat(s.total || 0); });

    const receiptMap = {};
    receiptSums.forEach(r => { if (r.client_id) receiptMap[r.client_id] = parseFloat(r.total || 0); });

    // Detect base AR code dynamically
    const arAccount = await db('accounts')
      .where({ company_id: companyId, is_control: true })
      .where('name', 'ilike', '%receivable%')
      .first();
    const baseCode = arAccount ? parseInt(arAccount.code, 10) : 1200;

    return clients.map((c, idx) => {
      const salesTotal = salesMap[c.id] || 0;
      const receiptsTotal = receiptMap[c.id] || 0;
      const balance = salesTotal - receiptsTotal;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status || 'ACTIVE',
        credit_limit: parseFloat(c.credit_limit || 0),
        code: String(baseCode + idx + 1),
        category: 'Asset',
        type: 'CUSTOMER',
        balance
      };
    });
  }

  static async getPayablesSubledger(companyId) {
    const vendors = await db('vendors').where({ company_id: companyId }).orderBy('name', 'asc');
    
    // Sum of posted PURCHASE vouchers
    const purchaseSums = await db('vouchers')
      .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', is_reversed: false, deleted_at: null })
      .select(db.raw("(payload->>'vendorId')::int as vendor_id"))
      .sum('total_amount as total')
      .groupByRaw("(payload->>'vendorId')::int");

    // Sum of posted PAYMENT vouchers
    const paymentSums = await db('vouchers')
      .where({ company_id: companyId, type: 'PAYMENT', status: 'POSTED', is_reversed: false, deleted_at: null })
      .select(db.raw("(payload->>'vendorId')::int as vendor_id"))
      .sum('total_amount as total')
      .groupByRaw("(payload->>'vendorId')::int");

    const purchaseMap = {};
    purchaseSums.forEach(p => { if (p.vendor_id) purchaseMap[p.vendor_id] = parseFloat(p.total || 0); });

    const paymentMap = {};
    paymentSums.forEach(p => { if (p.vendor_id) paymentMap[p.vendor_id] = parseFloat(p.total || 0); });

    // Detect base AP code dynamically
    const apAccount = await db('accounts')
      .where({ company_id: companyId, is_control: true })
      .where('name', 'ilike', '%payable%')
      .first();
    const baseCode = apAccount ? parseInt(apAccount.code, 10) : 2010;

    return vendors.map((v, idx) => {
      const purchaseTotal = purchaseMap[v.id] || 0;
      const paymentsTotal = paymentMap[v.id] || 0;
      const balance = purchaseTotal - paymentsTotal;

      return {
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        status: v.status || 'ACTIVE',
        credit_limit: parseFloat(v.credit_limit || 0),
        code: String(baseCode + idx + 1),
        category: 'Liability',
        type: 'SUPPLIER',
        balance
      };
    });
  }

  static async getAgingAnalysis(companyId, type) {
    const now = new Date();
    const buckets = { current: 0, days_30: 0, days_60: 0, days_90: 0, days_over_90: 0 };

    if (type === 'receivables') {
      const clients = await db('clients').where({ company_id: companyId });
      for (const client of clients) {
        // Calculate balance
        const sales = await db('vouchers')
          .where({ company_id: companyId, type: 'SALES', status: 'POSTED', is_reversed: false, deleted_at: null })
          .whereRaw("(payload->>'clientId')::int = ?", [client.id])
          .orderBy('date', 'desc');

        const receiptsTotal = await db('vouchers')
          .where({ company_id: companyId, type: 'RECEIPT', status: 'POSTED', is_reversed: false, deleted_at: null })
          .whereRaw("(payload->>'clientId')::int = ?", [client.id])
          .sum('total_amount as total')
          .first();

        let B = sales.reduce((acc, v) => acc + parseFloat(v.total_amount), 0) - parseFloat(receiptsTotal?.total || 0);
        if (B <= 0) continue;

        for (const invoice of sales) {
          const invAmt = parseFloat(invoice.total_amount);
          const allocated = Math.min(B, invAmt);
          if (allocated > 0) {
            const ageDays = Math.floor((now - new Date(invoice.date)) / (1000 * 60 * 60 * 24));
            if (ageDays <= 0) buckets.current += allocated;
            else if (ageDays <= 30) buckets.days_30 += allocated;
            else if (ageDays <= 60) buckets.days_60 += allocated;
            else if (ageDays <= 90) buckets.days_90 += allocated;
            else buckets.days_over_90 += allocated;
            B -= allocated;
          }
          if (B <= 0) break;
        }
      }
    } else if (type === 'payables') {
      // AP aging: unpaid (POSTED status) PURCHASE vouchers
      const unpaidBills = await db('vouchers')
        .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', is_reversed: false, deleted_at: null });

      for (const bill of unpaidBills) {
        const amt = parseFloat(bill.total_amount);
        const ageDays = Math.floor((now - new Date(bill.date)) / (1000 * 60 * 60 * 24));
        if (ageDays <= 0) buckets.current += amt;
        else if (ageDays <= 30) buckets.days_30 += amt;
        else if (ageDays <= 60) buckets.days_60 += amt;
        else if (ageDays <= 90) buckets.days_90 += amt;
        else buckets.days_over_90 += amt;
      }
    }

    return buckets;
  }

  static async getIndividualAging(companyId, type, id) {
    const now = new Date();
    const buckets = { current: 0, days_30: 0, days_60: 0, days_90: 0, days_over_90: 0 };

    if (type === 'customer') {
      const sales = await db('vouchers')
        .where({ company_id: companyId, type: 'SALES', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'clientId')::int = ?", [id])
        .orderBy('date', 'desc');

      const receiptsTotal = await db('vouchers')
        .where({ company_id: companyId, type: 'RECEIPT', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'clientId')::int = ?", [id])
        .sum('total_amount as total')
        .first();

      let B = sales.reduce((acc, v) => acc + parseFloat(v.total_amount), 0) - parseFloat(receiptsTotal?.total || 0);
      if (B > 0) {
        for (const invoice of sales) {
          const invAmt = parseFloat(invoice.total_amount);
          const allocated = Math.min(B, invAmt);
          if (allocated > 0) {
            const ageDays = Math.floor((now - new Date(invoice.date)) / (1000 * 60 * 60 * 24));
            if (ageDays <= 0) buckets.current += allocated;
            else if (ageDays <= 30) buckets.days_30 += allocated;
            else if (ageDays <= 60) buckets.days_60 += allocated;
            else if (ageDays <= 90) buckets.days_90 += allocated;
            else buckets.days_over_90 += allocated;
            B -= allocated;
          }
          if (B <= 0) break;
        }
      }
    } else if (type === 'supplier') {
      const unpaidBills = await db('vouchers')
        .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', is_reversed: false, deleted_at: null })
        .whereRaw("(payload->>'vendorId')::int = ?", [id]);

      for (const bill of unpaidBills) {
        const amt = parseFloat(bill.total_amount);
        const ageDays = Math.floor((now - new Date(bill.date)) / (1000 * 60 * 60 * 24));
        if (ageDays <= 0) buckets.current += amt;
        else if (ageDays <= 30) buckets.days_30 += amt;
        else if (ageDays <= 60) buckets.days_60 += amt;
        else if (ageDays <= 90) buckets.days_90 += amt;
        else buckets.days_over_90 += amt;
      }
    }

    return buckets;
  }

  static async getCustomerStatement(companyId, clientId) {
    const client = await db('clients').where({ id: clientId, company_id: companyId }).first();
    if (!client) throw new Error('Customer not found.');

    const salesVouchers = await db('vouchers')
      .where({ company_id: companyId, type: 'SALES', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'clientId')::int = ?", [clientId]);

    const receipts = await db('vouchers')
      .where({ company_id: companyId, type: 'RECEIPT', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'clientId')::int = ?", [clientId]);

    const txs = [];
    salesVouchers.forEach(v => {
      txs.push({
        id: v.id,
        date: v.date,
        reference: v.voucher_number,
        type: 'SALES',
        debit: parseFloat(v.total_amount || 0),
        credit: 0
      });
    });

    receipts.forEach(r => {
      txs.push({
        id: r.id,
        date: r.date,
        reference: r.voucher_number,
        type: 'RECEIPT',
        debit: 0,
        credit: parseFloat(r.total_amount || 0)
      });
    });

    txs.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const statement = txs.map(tx => {
      balance = balance + tx.debit - tx.credit;
      return {
        ...tx,
        runningBalance: balance
      };
    });

    return {
      clientId: client.id,
      clientName: client.name,
      currentBalance: balance,
      statement
    };
  }

  static async getVendorStatement(companyId, vendorId) {
    const vendor = await db('vendors').where({ id: vendorId, company_id: companyId }).first();
    if (!vendor) throw new Error('Supplier not found.');

    const purchases = await db('vouchers')
      .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'vendorId')::int = ?", [vendorId]);

    const payments = await db('vouchers')
      .where({ company_id: companyId, type: 'PAYMENT', status: 'POSTED', is_reversed: false, deleted_at: null })
      .whereRaw("(payload->>'vendorId')::int = ?", [vendorId]);

    const txs = [];
    purchases.forEach(p => {
      txs.push({
        id: p.id,
        date: p.date,
        reference: p.voucher_number,
        type: 'PURCHASE',
        debit: 0,
        credit: parseFloat(p.total_amount || 0)
      });
    });

    payments.forEach(p => {
      txs.push({
        id: p.id,
        date: p.date,
        reference: p.voucher_number,
        type: 'PAYMENT',
        debit: parseFloat(p.total_amount || 0),
        credit: 0
      });
    });

    txs.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const statement = txs.map(tx => {
      balance = balance + tx.credit - tx.debit;
      return {
        ...tx,
        runningBalance: balance
      };
    });

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      currentBalance: balance,
      statement
    };
  }

  static async getSubledgerSummary(companyId) {
    const receivables = await this.getReceivablesSubledger(companyId);
    const payables = await this.getPayablesSubledger(companyId);

    const arTotal = receivables.reduce((sum, r) => sum + r.balance, 0);
    const apTotal = payables.reduce((sum, p) => sum + p.balance, 0);

    const arAging = await this.getAgingAnalysis(companyId, 'receivables');
    const apAging = await this.getAgingAnalysis(companyId, 'payables');

    const arOverdue = arAging.days_30 + arAging.days_60 + arAging.days_90 + arAging.days_over_90;
    const apDueThisWeek = apAging.current;

    return {
      receivables: {
        total_balance: arTotal,
        customer_count: receivables.length,
        overdue: arOverdue
      },
      payables: {
        total_balance: apTotal,
        supplier_count: payables.length,
        due_this_week: apDueThisWeek
      }
    };
  }
}

module.exports = SubledgerService;
