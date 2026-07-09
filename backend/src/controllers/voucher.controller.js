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
    res.json(voucher);
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
