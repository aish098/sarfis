const VoucherService = require('../services/voucher.service');
const VendorModel = require('../models/vendor.model');
const PostingEngineService = require('../services/posting_engine.service');
const db = require('../config/db');
const TransactionInquiryService = require('../services/transaction_inquiry.service');

exports.getVouchers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { type, status, from, to } = req.query;
    const vouchers = await VoucherService.getVouchers(companyId, { type, status, from, to });
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVoucherById = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const voucher = await VoucherService.getVoucherById(id, companyId);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

    // Fetch related PO
    let relatedPo = null;
    if (voucher.purchase_order_id) {
      relatedPo = await db('purchase_orders as po')
        .leftJoin('users as u', 'po.created_by', 'u.id')
        .where({ 'po.id': voucher.purchase_order_id, 'po.company_id': companyId })
        .select('po.id', 'po.po_number', 'po.status', 'po.created_at', 'u.name as creator_name')
        .first();
    }

    // Fetch related deliveries
    const relatedDeliveries = await db('deliveries as d')
      .leftJoin('users as u', 'd.created_by', 'u.id')
      .where({ 'd.voucher_id': id, 'd.company_id': companyId })
      .select('d.id', 'd.delivery_number', 'd.status', 'd.created_at', 'u.name as creator_name');

    res.json({
      ...voucher,
      relatedPo,
      relatedDeliveries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { type, date, payload, totalAmount, taxAmount } = req.body;
    
    const draft = await VoucherService.createDraft({
      companyId,
      type,
      date,
      payload,
      totalAmount,
      taxAmount,
      userId: req.user?.id
    });
    res.status(201).json(draft);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { date, payload, totalAmount, taxAmount } = req.body;

    const updated = await VoucherService.updateDraft(id, companyId, {
      date,
      payload,
      totalAmount,
      taxAmount,
      userId: req.user?.id
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.submitForApproval = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const submitted = await VoucherService.submitForApproval(id, companyId, req.user?.id);
    res.json(submitted);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.postVoucher = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const posted = await VoucherService.postToLedger(id, companyId, req.user?.id);
    res.json(posted);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    await VoucherService.deleteVoucher(id, companyId, req.user?.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.reverseVoucher = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const result = await VoucherService.reverseVoucher(id, companyId, req.user?.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// --- VENDOR MANAGEMENT CONTROLLER ENDPOINTS ---
exports.getVendors = async (req, res) => {
  try {
    const { companyId } = req.params;
    const vendors = await VendorModel.getByCompany(companyId);
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const { companyId } = req.params;
    const vendor = await VendorModel.create({
      companyId,
      ...req.body
    });
    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const vendor = await VendorModel.update(id, companyId, req.body);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    await VendorModel.delete(id, companyId);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// --- ACCOUNTING PERIODS CONTROLLER ENDPOINTS ---
exports.getPeriods = async (req, res) => {
  try {
    const { companyId } = req.params;
    const periods = await db('accounting_periods')
      .where({ company_id: companyId })
      .orderBy('start_date', 'asc');
    res.json(periods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPeriod = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { periodName, startDate, endDate, status } = req.body;
    const [period] = await db('accounting_periods')
      .insert({
        company_id: companyId,
        period_name: periodName,
        start_date: startDate,
        end_date: endDate,
        status: status || 'OPEN'
      })
      .returning('*');
    res.status(201).json(period);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.initializeFiscalYear = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { fiscalYear: bodyYear, year } = req.body || {};
    const fiscalYear = parseInt(bodyYear || year) || new Date().getFullYear();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let createdCount = 0;
    let skippedCount = 0;

    await db.transaction(async (trx) => {
      for (let i = 0; i < 12; i++) {
        const monthName = monthNames[i];
        const pName = `${monthName} ${fiscalYear}`;

        const start = `${fiscalYear}-${String(i + 1).padStart(2, '0')}-01`;
        const endDay = new Date(Date.UTC(fiscalYear, i + 1, 0)).getUTCDate();
        const end = `${fiscalYear}-${String(i + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        // Check if period already exists
        const existing = await trx('accounting_periods')
          .where({ company_id: companyId, period_name: pName })
          .first();

        if (existing) {
          skippedCount++;
        } else {
          await trx('accounting_periods')
            .insert({
              company_id: companyId,
              period_name: pName,
              start_date: start,
              end_date: end,
              status: 'OPEN',
              created_at: trx.fn.now(),
              updated_at: trx.fn.now()
            });
          createdCount++;
        }
      }
    });

    res.status(201).json({
      created: createdCount,
      skipped: skippedCount
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.generateMissingPeriods = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { fiscalYear: bodyYear, year } = req.body || {};
    const fiscalYear = parseInt(bodyYear || year) || new Date().getFullYear();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let createdCount = 0;
    let existingCount = 0;

    await db.transaction(async (trx) => {
      for (let i = 0; i < 12; i++) {
        const monthName = monthNames[i];
        const pName = `${monthName} ${fiscalYear}`;

        const start = `${fiscalYear}-${String(i + 1).padStart(2, '0')}-01`;
        const endDay = new Date(Date.UTC(fiscalYear, i + 1, 0)).getUTCDate();
        const end = `${fiscalYear}-${String(i + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        // Check if period already exists
        const existing = await trx('accounting_periods')
          .where({ company_id: companyId, period_name: pName })
          .first();

        if (existing) {
          existingCount++;
        } else {
          await trx('accounting_periods')
            .insert({
              company_id: companyId,
              period_name: pName,
              start_date: start,
              end_date: end,
              status: 'OPEN',
              created_at: trx.fn.now(),
              updated_at: trx.fn.now()
            });
          createdCount++;
        }
      }
    });

    res.status(200).json({
      created: createdCount,
      existing: existingCount
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updatePeriodStatus = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { status, periodName, startDate, endDate } = req.body;

    const updates = {};
    if (status) {
      if (!['OPEN', 'CLOSED'].includes(status)) throw new Error('Invalid status.');
      updates.status = status;
    }
    if (periodName) updates.period_name = periodName;
    if (startDate) updates.start_date = startDate;
    if (endDate) updates.end_date = endDate;

    updates.updated_at = db.fn.now();

    const [period] = await db('accounting_periods')
      .where({ id, company_id: companyId })
      .update(updates)
      .returning('*');

    if (status === 'OPEN') {
      await db('period_close_sessions')
        .where({ company_id: companyId, period_id: id })
        .whereIn('status', ['CLOSED', 'PENDING_APPROVAL'])
        .update({
          status: 'REOPENED',
          updated_at: db.fn.now()
        });
    }

    if (status) {
      try {
        const NotificationService = require('../services/notification.service');
        const modifier = await db('users').where({ id: req.user.id }).first();
        const modifierName = modifier ? modifier.name : 'An administrator';

        await NotificationService.notifyUsersWithPermission({
          companyId: parseInt(companyId),
          permissionCode: 'period.view',
          title: `Fiscal Period ${status === 'CLOSED' ? 'Locked' : 'Unlocked'}`,
          message: `Accounting period ${period.period_name} has been ${status === 'CLOSED' ? 'locked' : 'unlocked'} by ${modifierName}.`,
          type: 'period',
          priority: 'HIGH',
          entityType: 'admin',
          entityId: period.id
        });
      } catch (notifErr) {
        console.error('Failed to notify period status change:', notifErr);
      }
    }

    res.json(period);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// --- SETTINGS CONTROLLER ENDPOINTS ---
exports.getSettings = async (req, res) => {
  try {
    const { companyId } = req.params;
    const settings = await PostingEngineService.getAccountingSettings(companyId);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { companyId } = req.params;
    const [updated] = await db('company_accounting_settings')
      .where({ company_id: companyId })
      .update({
        default_sales_account_id: req.body.defaultSalesAccountId,
        default_ap_account_id: req.body.defaultApAccountId,
        default_ar_account_id: req.body.defaultArAccountId,
        default_inventory_account_id: req.body.defaultInventoryAccountId,
        default_cogs_account_id: req.body.defaultCogsAccountId,
        default_cash_account_id: req.body.defaultCashAccountId,
        tax_rate: parseFloat(req.body.taxRate || 0),
        negative_balance_style: req.body.negativeBalanceStyle || 'minus'
      })
      .returning('*');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getTransactionInquiry = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const details = await TransactionInquiryService.getTransactionInquiryDetails(id, companyId);
    res.json(details);
  } catch (err) {
    if (err.message === 'Voucher not found') {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

exports.addVoucherComment = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { text } = req.body;
    if (!text) throw new Error('Comment text is required.');

    await db('transaction_audit_logs').insert({
      company_id: companyId,
      voucher_id: id,
      action: 'COMMENT',
      user_id: req.user?.id,
      description: `Comment: ${text}`
    });
    res.status(201).json({ message: 'Comment added successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const PeriodCloseService = require('../services/period_close.service');

exports.getPeriodCloseChecklist = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const checklist = await PeriodCloseService.getChecklist(companyId, id);
    res.json(checklist);
  } catch (err) {
    console.error('Checklist compilation error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.closePeriod = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const userId = req.user.id;
    const closedPeriod = await PeriodCloseService.closePeriod(companyId, id, userId);
    res.json({ message: 'Period closed and locked successfully', period: closedPeriod });
  } catch (err) {
    console.error('Period Close Error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.reopenPeriod = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const openedPeriod = await PeriodCloseService.reopenPeriod(companyId, id, userId, reason);
    res.json({ message: 'Period reopened successfully', period: openedPeriod });
  } catch (err) {
    console.error('Period Reopen Error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.getPeriodHistory = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const history = await db('period_close_history as pch')
      .join('users as u', 'pch.performed_by', 'u.id')
      .select('pch.*', 'u.name as performed_name')
      .where({ 'pch.company_id': companyId, 'pch.period_id': id })
      .orderBy('pch.performed_at', 'desc');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
