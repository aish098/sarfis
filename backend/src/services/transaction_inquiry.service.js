const db = require('../config/db');

class TransactionInquiryService {
  static async getTransactionInquiryDetails(voucherId, companyId) {
    // 1. Fetch the main Voucher document
    const voucher = await db('vouchers')
      .where({ id: voucherId, company_id: companyId, deleted_at: null })
      .first();

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    // Resolve creator and approver usernames
    let creatorName = 'System';
    if (voucher.created_by) {
      const creator = await db('users').where({ id: voucher.created_by }).first();
      if (creator) creatorName = creator.name;
    }
    let approverName = null;
    if (voucher.approved_by) {
      const approver = await db('users').where({ id: voucher.approved_by }).first();
      if (approver) approverName = approver.name;
    }

    const document = {
      id: voucher.id,
      type: voucher.type,
      voucherNumber: voucher.voucher_number,
      date: voucher.date,
      status: voucher.status,
      totalAmount: parseFloat(voucher.total_amount || 0),
      taxAmount: parseFloat(voucher.tax_amount || 0),
      isReversed: !!voucher.is_reversed,
      reversalVoucherId: voucher.reversal_voucher_id,
      overrideRequestId: voucher.override_request_id,
      creatorName,
      approverName,
      createdAt: voucher.created_at,
      updatedAt: voucher.updated_at,
      payload: voucher.payload || {}
    };

    // 2. Fetch Financial Impact (Journal Entries & Ledger Lines)
    let financial = {
      journalEntry: null,
      journalLines: []
    };

    if (voucher.journal_entry_id) {
      const je = await db('journal_entries')
        .where({ id: voucher.journal_entry_id, company_id: companyId })
        .first();

      if (je) {
        const lines = await db('journal_lines as jl')
          .join('accounts as a', 'jl.account_id', 'a.id')
          .where('jl.entry_id', je.id)
          .select('jl.*', 'a.name as account_name', 'a.code as account_code')
          .orderBy('jl.debit', 'desc');

        financial = {
          journalEntry: {
            ...je,
            entry_number: `JE-${String(je.id).padStart(5, '0')}`
          },
          journalLines: lines.map(l => ({
            ...l,
            debit: parseFloat(l.debit || 0),
            credit: parseFloat(l.credit || 0)
          }))
        };
      }
    }

    // 3. Fetch Inventory Impact (Warehouse Context & Stock Movements)
    let inventory = {
      movements: [],
      warehouse: null
    };

    const warehouseId = voucher.payload?.warehouseId || voucher.payload?.warehouse_id;
    if (warehouseId) {
      const wh = await db('warehouses').where({ id: warehouseId }).first();
      if (wh) {
        inventory.warehouse = wh;
      }
    }

    if (voucher.journal_entry_id) {
      const movements = await db('stock_logs as sl')
        .join('products as p', 'sl.product_id', 'p.id')
        .where({ 'sl.reference_id': voucher.journal_entry_id, 'sl.reference_type': 'journal_entry' })
        .select('sl.*', 'p.name as product_name', 'p.sku as product_sku')
        .orderBy('sl.created_at', 'asc');

      inventory.movements = movements.map(m => ({
        ...m,
        quantity_change: parseFloat(m.quantity_change || 0),
        quantity_after: parseFloat(m.quantity_after || 0),
        unit_cost: parseFloat(m.unit_cost || 0)
      }));
    }

    // 4. Fetch Business Partner Credit & Utilization summary
    let business = {
      customer: null,
      vendor: null,
      creditSummary: null
    };

    const clientId = voucher.payload?.clientId || voucher.payload?.client_id;
    const vendorId = voucher.payload?.vendorId || voucher.payload?.vendor_id;

    if (clientId) {
      const customer = await db('clients').where({ id: clientId }).first();
      if (customer) {
        business.customer = customer;

        const activeRisk = await db('business_relationship_status')
          .where({ company_id: companyId, entity_id: clientId, entity_type: 'CUSTOMER' })
          .first();

        const outstanding = parseFloat(customer.outstanding_balance || 0);
        const creditLimit = parseFloat(customer.credit_limit || 200000);
        const availableCredit = Math.max(0, creditLimit - outstanding);
        const creditUtilization = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;

        business.creditSummary = {
          creditLimit,
          outstanding,
          availableCredit,
          creditUtilization,
          riskLevel: activeRisk ? activeRisk.risk_level : 'LOW',
          riskScore: activeRisk ? activeRisk.risk_score : 0
        };
      }
    } else if (vendorId) {
      const vendor = await db('vendors').where({ id: vendorId }).first();
      if (vendor) {
        business.vendor = vendor;

        const activeRisk = await db('business_relationship_status')
          .where({ company_id: companyId, entity_id: vendorId, entity_type: 'VENDOR' })
          .first();

        const outstanding = parseFloat(vendor.current_balance || 0);
        business.creditSummary = {
          outstanding,
          riskLevel: activeRisk ? activeRisk.risk_level : 'LOW',
          riskScore: activeRisk ? activeRisk.risk_score : 0
        };
      }
    }

    // 5. Fetch Governance Risk Score & Override logs
    let risk = {
      status: null,
      override: null
    };

    const activeRiskRecord = await db('business_relationship_status')
      .where({
        company_id: companyId,
        entity_id: clientId || vendorId,
        entity_type: clientId ? 'CUSTOMER' : 'VENDOR'
      })
      .first();

    risk.status = {
      score: activeRiskRecord ? activeRiskRecord.risk_score : 0,
      level: activeRiskRecord ? activeRiskRecord.risk_level : 'LOW',
      status: activeRiskRecord ? activeRiskRecord.status : 'ACTIVE',
      cashOnly: activeRiskRecord ? !!activeRiskRecord.cash_only : false
    };

    if (voucher.override_request_id) {
      const req = await db('risk_approval_requests as r')
        .leftJoin('users as u', 'r.approved_by', 'u.id')
        .where('r.id', voucher.override_request_id)
        .select('r.*', 'u.name as approved_by_name')
        .first();
      if (req) {
        risk.override = req;
      }
    }

    // 6. Fetch Timeline & Audit Log Logs
    const auditLogs = await db('transaction_audit_logs as al')
      .leftJoin('users as u', 'al.user_id', 'u.id')
      .where('al.voucher_id', voucherId)
      .select('al.*', 'u.name as user_name')
      .orderBy('al.created_at', 'asc');

    const timeline = auditLogs.map(log => ({
      id: log.id,
      action: log.action,
      userName: log.user_name || 'System',
      description: log.description,
      timestamp: log.created_at
    }));

    const audit = {
      timeline,
      logs: auditLogs
    };

    // 7. Comments List
    const comments = auditLogs
      .filter(l => l.action.toUpperCase() === 'COMMENT' || l.description?.startsWith('Comment:'))
      .map(c => ({
        id: c.id,
        userName: c.user_name || 'System',
        text: c.description.replace('Comment:', '').trim(),
        timestamp: c.created_at
      }));

    // 8. Navigation Graph Links
    const relatedDocuments = [];
    if (voucher.payload?.quotation_number) {
      relatedDocuments.push({ type: 'QUOTATION', code: voucher.payload.quotation_number, label: 'Sales Quotation' });
    }
    if (voucher.payload?.sales_order_number) {
      relatedDocuments.push({ type: 'ORDER', code: voucher.payload.sales_order_number, label: 'Sales Order' });
    }
    if (voucher.payload?.delivery_number) {
      relatedDocuments.push({ type: 'DELIVERY', code: voucher.payload.delivery_number, label: 'Delivery Note' });
    }

    relatedDocuments.push({ type: 'VOUCHER', code: voucher.voucher_number, id: voucher.id, label: `${voucher.type} Voucher`, active: true });

    if (financial.journalEntry) {
      relatedDocuments.push({ type: 'JOURNAL', code: financial.journalEntry.entry_number, label: 'Journal Entry' });
    }

    // 9. Static or dynamic Attachments
    const attachments = voucher.payload?.attachments || [
      { id: 1, name: 'Invoice_Copy.pdf', size: '142 KB', type: 'application/pdf' },
      { id: 2, name: 'Delivery_Note_Signed.pdf', size: '98 KB', type: 'application/pdf' }
    ];

    return {
      document,
      financial,
      inventory,
      business,
      risk,
      audit,
      comments,
      relatedDocuments,
      attachments
    };
  }
}

module.exports = TransactionInquiryService;
