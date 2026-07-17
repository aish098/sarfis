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

    const payload = voucher.payload || {};
    if (payload.items && Array.isArray(payload.items)) {
      const resolvedItems = await Promise.all(
        payload.items.map(async (item) => {
          if (item.productId) {
            const product = await db('products').where({ id: item.productId }).first();
            if (product) {
              return {
                ...item,
                productName: product.name,
                productSku: product.sku
              };
            }
          }
          return item;
        })
      );
      payload.items = resolvedItems;
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
      payload
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
      status: {
        score: 0,
        level: 'LOW',
        status: 'ACTIVE',
        cashOnly: false
      },
      override: null
    };

    if (clientId || vendorId) {
      const activeRiskRecord = await db('business_relationship_status')
        .where({
          company_id: companyId,
          entity_id: clientId || vendorId,
          entity_type: clientId ? 'CUSTOMER' : 'VENDOR'
        })
        .first();

      if (activeRiskRecord) {
        risk.status = {
          score: activeRiskRecord.risk_score,
          level: activeRiskRecord.risk_level,
          status: activeRiskRecord.status,
          cashOnly: !!activeRiskRecord.cash_only
        };
      }
    }

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
    let relatedDocuments = [];
    if (voucher.type === 'PURCHASE' || voucher.type === 'PAYMENT') {
      const ProcurementLineageService = require('./procurement_lineage.service');
      try {
        const lineage = await ProcurementLineageService.getLineage('VOUCHER', voucher.id, companyId);
        relatedDocuments = lineage.map(doc => ({
          type: doc.type,
          code: doc.number,
          label: doc.type === 'PURCHASE_REQUISITION' ? 'Purchase Requisition' :
                 doc.type === 'PURCHASE_ORDER' ? 'Purchase Order' :
                 doc.type === 'GOODS_RECEIPT' ? 'Goods Receipt Note' :
                 doc.type === 'VOUCHER' ? 'Purchase Voucher' :
                 doc.type === 'PAYMENT' ? 'Payment Voucher' : doc.type,
          active: (doc.type === 'VOUCHER' || doc.type === 'PAYMENT') && String(doc.id) === String(voucher.id)
        }));
      } catch (lineageErr) {
        console.error('Failed to resolve procurement lineage:', lineageErr);
        relatedDocuments.push({ type: 'VOUCHER', code: voucher.voucher_number, id: voucher.id, label: `${voucher.type} Voucher`, active: true });
      }

      if (financial.journalEntry) {
        relatedDocuments.push({ type: 'JOURNAL', code: financial.journalEntry.entry_number, label: 'Journal Entry' });
      }
    } else {
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
    }

    // Resolve related PO, Requisition, and Deliveries/GRNs for procurement flow
    let relatedPo = null;
    let relatedRequisition = null;
    let relatedDeliveries = [];

    let targetPoId = voucher.purchase_order_id;
    let targetGrnId = voucher.goods_receipt_id;

    if (voucher.type === 'PAYMENT' && voucher.payload?.purchase_voucher_id) {
      const parentPv = await db('vouchers').where({ id: voucher.payload.purchase_voucher_id }).first();
      if (parentPv) {
        targetPoId = parentPv.purchase_order_id;
        targetGrnId = parentPv.goods_receipt_id;
      }
    }

    if (targetGrnId) {
      const grn = await db('goods_receipts as gr')
        .leftJoin('users as u', 'gr.received_by', 'u.id')
        .where('gr.id', targetGrnId)
        .select('gr.*', 'u.name as creator_name')
        .first();
      if (grn) {
        relatedDeliveries.push({
          id: grn.id,
          delivery_number: grn.grn_number,
          status: grn.status,
          created_at: grn.created_at,
          creator_name: grn.creator_name
        });
        if (!targetPoId) targetPoId = grn.purchase_order_id;
      }
    }

    if (targetPoId) {
      const po = await db('purchase_orders as po')
        .leftJoin('users as u', 'po.created_by', 'u.id')
        .where('po.id', targetPoId)
        .select('po.*', 'u.name as creator_name')
        .first();
      if (po) {
        relatedPo = {
          id: po.id,
          po_number: po.po_number,
          status: po.status,
          created_at: po.created_at,
          creator_name: po.creator_name
        };
        if (po.purchase_requisition_id) {
          const pr = await db('purchase_requisitions as pr')
            .leftJoin('users as u', 'pr.requested_by', 'u.id')
            .where('pr.id', po.purchase_requisition_id)
            .select('pr.*', 'u.name as creator_name')
            .first();
          if (pr) {
            relatedRequisition = {
              id: pr.id,
              requisition_number: pr.requisition_number,
              status: pr.status,
              created_at: pr.created_at,
              creator_name: pr.creator_name
            };
          }
        }
      }
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
      attachments,
      relatedPo,
      relatedRequisition,
      relatedDeliveries
    };
  }
}

module.exports = TransactionInquiryService;
