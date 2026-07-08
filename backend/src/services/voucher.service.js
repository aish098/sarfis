const db = require('../config/db');
const PostingEngineService = require('./posting_engine.service');
const VendorModel = require('../models/vendor.model');
const distModel = require('../models/distribution.model');
const inventoryModel = require('../models/inventory.model');
const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');

class VoucherService {
  /**
   * Generates next voucher number using autonumber sequence table
   */
  static async generateVoucherNumber(companyId, type, trx) {
    const defaultPrefixes = {
      'PURCHASE': 'PV',
      'SALES': 'SV',
      'RECEIPT': 'RV',
      'PAYMENT': 'KV',
      'JOURNAL': 'JV'
    };

    const prefix = defaultPrefixes[type.toUpperCase()] || 'VO';

    const getSeq = db('voucher_sequences').where({ company_id: companyId, type });
    if (trx) getSeq.transacting(trx);
    let seq = await getSeq.first();

    if (!seq) {
      seq = { company_id: companyId, type, prefix, next_val: 1 };
      const insertQuery = db('voucher_sequences');
      if (trx) insertQuery.transacting(trx);
      await insertQuery.insert(seq);
    }

    const num = `${seq.prefix}-${String(seq.next_val).padStart(5, '0')}`;

    const updateQuery = db('voucher_sequences')
      .where({ company_id: companyId, type })
      .increment('next_val', 1);
    if (trx) updateQuery.transacting(trx);
    await updateQuery;

    return num;
  }

  /**
   * Retrieves list of vouchers with optional filters
   */
  static async getVouchers(companyId, filters = {}) {
    let query = db('vouchers as v')
      .where('v.company_id', companyId)
      .andWhere('v.deleted_at', null)
      .orderBy('v.date', 'desc')
      .orderBy('v.created_at', 'desc');

    if (filters.type) query = query.where('v.type', filters.type.toUpperCase());
    if (filters.status) query = query.where('v.status', filters.status.toUpperCase());
    if (filters.from) query = query.where('v.date', '>=', filters.from);
    if (filters.to) query = query.where('v.date', '<=', filters.to);

    return await query;
  }

  /**
   * Retrieves single voucher by ID
   */
  static async getVoucherById(id, companyId) {
    return await db('vouchers')
      .where({ id, company_id: companyId, deleted_at: null })
      .first();
  }

  /**
   * Creates a draft voucher
   */
  static async createDraft({ companyId, type, date, payload, totalAmount, taxAmount, userId }) {
    if (!companyId) throw new Error('Company context required.');
    if (!type) throw new Error('Voucher type required.');

    return await db.transaction(async (trx) => {
      const voucherNumber = await this.generateVoucherNumber(companyId, type, trx);
      const overrideRequestId = payload?.override_request_id ? parseInt(payload.override_request_id) : null;

      const [voucher] = await trx('vouchers')
        .insert({
          company_id: companyId,
          type: type.toUpperCase(),
          voucher_number: voucherNumber,
          date: date || new Date(),
          status: 'DRAFT',
          payload: payload || {},
          total_amount: parseFloat(totalAmount || 0),
          tax_amount: parseFloat(taxAmount || 0),
          override_request_id: overrideRequestId,
          created_by: userId
        })
        .returning('*');

      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: voucher.id,
        action: 'CREATE',
        user_id: userId,
        description: `Created draft voucher ${voucherNumber} of type ${type.toUpperCase()}.`
      });

      return voucher;
    });
  }

  /**
   * Updates a draft voucher
   */
  static async updateDraft(id, companyId, { date, payload, totalAmount, taxAmount, userId }) {
    return await db.transaction(async (trx) => {
      const voucher = await trx('vouchers')
        .where({ id, company_id: companyId, deleted_at: null })
        .first();

      if (!voucher) throw new Error('Voucher not found.');
      if (voucher.status === 'POSTED') throw new Error('Cannot edit a posted voucher.');

      const overrideRequestId = payload?.override_request_id !== undefined 
        ? (payload.override_request_id ? parseInt(payload.override_request_id) : null)
        : voucher.override_request_id;

      const [updated] = await trx('vouchers')
        .where({ id, company_id: companyId })
        .update({
          date: date || voucher.date,
          payload: payload || voucher.payload,
          total_amount: totalAmount !== undefined ? parseFloat(totalAmount) : voucher.total_amount,
          tax_amount: taxAmount !== undefined ? parseFloat(taxAmount) : voucher.tax_amount,
          override_request_id: overrideRequestId,
          updated_at: trx.fn.now()
        })
        .returning('*');

      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: id,
        action: 'UPDATE',
        user_id: userId,
        description: `Updated draft voucher ${voucher.voucher_number}.`
      });

      return updated;
    });
  }

  /**
   * Submits a draft voucher for review/approval
   */
  static async submitForApproval(id, companyId, userId) {
    const updated = await db.transaction(async (trx) => {
      const voucher = await trx('vouchers').where({ id, company_id: companyId, deleted_at: null }).first();
      if (!voucher) throw new Error('Voucher not found.');
      if (voucher.status !== 'DRAFT') throw new Error('Only draft vouchers can be submitted for approval.');

      const [up] = await trx('vouchers')
        .where({ id, company_id: companyId })
        .update({
          status: 'PENDING_APPROVAL',
          updated_at: trx.fn.now()
        })
        .returning('*');

      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: id,
        action: 'SUBMIT_APPROVAL',
        user_id: userId,
        description: `Submitted voucher ${voucher.voucher_number} for manager approval.`
      });

      return up;
    });

    try {
      const NotificationService = require('./notification.service');
      const submitter = await db('users').where({ id: userId }).first();
      const submitterName = submitter ? submitter.name : 'A user';

      // 1. Notify users with voucher.post permission
      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'voucher.post',
        title: 'Voucher Pending Approval',
        message: `Voucher ${updated.voucher_number} (${updated.type}) of PKR ${parseFloat(updated.total_amount).toLocaleString()} submitted by ${submitterName} requires approval.`,
        type: 'approval',
        priority: 'HIGH',
        entityType: 'voucher',
        entityId: id
      });

      // 2. Notify users with voucher.approve permission
      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'voucher.approve',
        title: 'Voucher Submitted for Review',
        message: `Voucher ${updated.voucher_number} (${updated.type}) submitted by ${submitterName} is awaiting review.`,
        type: 'approval',
        priority: 'MEDIUM',
        entityType: 'voucher',
        entityId: id
      });
    } catch (err) {
      console.error('Failed to dispatch notifications for voucher submission:', err);
    }

    return updated;
  }

  /**
   * Posts a voucher (DRAFT or PENDING_APPROVAL) to the General Ledger using PostingEngine
   */
  static async postToLedger(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const voucher = await trx('vouchers').where({ id, company_id: companyId, deleted_at: null }).first();
      if (!voucher) throw new Error('Voucher not found.');
      if (voucher.status === 'POSTED') throw new Error('Voucher is already posted.');

      // Execute Posting Engine
      const { journalEntryId, totalAmount } = await PostingEngineService.postTransaction({
        type: voucher.type,
        companyId,
        payload: voucher.payload,
        userId,
        voucherId: id
      }, trx);

      const activeOverride = await trx('risk_approval_requests')
        .where({
          company_id: companyId,
          status: 'APPROVED',
          voucher_id: id
        })
        .where('expires_at', '>', new Date())
        .first();

      const [updated] = await trx('vouchers')
        .where({ id, company_id: companyId })
        .update({
          status: 'POSTED',
          journal_entry_id: journalEntryId,
          total_amount: totalAmount,
          override_request_id: activeOverride ? activeOverride.id : voucher.override_request_id,
          approved_by: userId,
          updated_at: trx.fn.now()
        })
        .returning('*');

      return updated;
    });
  }

  /**
   * Soft deletes a draft voucher
   */
  static async deleteVoucher(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const voucher = await trx('vouchers').where({ id, company_id: companyId, deleted_at: null }).first();
      if (!voucher) throw new Error('Voucher not found.');
      if (voucher.status === 'POSTED') throw new Error('Cannot delete a posted voucher. Reversal is required.');

      const [deleted] = await trx('vouchers')
        .where({ id, company_id: companyId })
        .update({
          deleted_at: trx.fn.now(),
          updated_at: trx.fn.now()
        })
        .returning('*');

      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: id,
        action: 'DELETE',
        user_id: userId,
        description: `Soft deleted voucher ${voucher.voucher_number}.`
      });

      return deleted;
    });
  }

  /**
   * Reverses a posted voucher cleanly by applying opposite journal offset double entries
   */
  static async reverseVoucher(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const voucher = await trx('vouchers').where({ id, company_id: companyId, deleted_at: null }).first();
      if (!voucher) throw new Error('Voucher not found.');
      if (voucher.status !== 'POSTED') throw new Error('Only posted vouchers can be reversed.');
      if (voucher.is_reversed) throw new Error('Voucher is already reversed.');

      // 1. Verify accounting period lock for reversal date
      const reversalDate = new Date();
      await PostingEngineService.assertPeriodOpen(companyId, reversalDate, trx);

      // 2. Load the original journal entry lines
      if (!voucher.journal_entry_id) throw new Error('Associated journal entry not found for this voucher.');
      
      const lines = await trx('journal_lines')
        .where({ entry_id: voucher.journal_entry_id });

      if (lines.length === 0) throw new Error('Original journal lines are empty.');

      // 3. Create Reversal Journal Entry Header
      const reversalDescription = `REVERSAL of ${voucher.type} Voucher #${voucher.voucher_number}`;
      const revEntryId = await JournalModel.createEntry({
        companyId,
        entryDate: reversalDate,
        description: reversalDescription,
        userId
      }, trx);

      // 4. Post Swapped Lines (Swapping Debit and Credit to net it to zero)
      for (const line of lines) {
        const revDebit = line.credit;
        const revCredit = line.debit;

        await JournalModel.createLine({
          entryId: revEntryId,
          accountId: line.account_id,
          debit: revDebit,
          credit: revCredit
        }, trx);

        // Update cached account balance
        await AccountModel.updateBalance(line.account_id, companyId, revDebit, revCredit, trx);
      }

      // 5. Update associated balances depending on voucher type
      const type = voucher.type.toUpperCase();
      const payload = voucher.payload;

      if (type === 'PURCHASE') {
        // Reduce vendor AP balance
        await VendorModel.updateBalance(payload.vendorId, companyId, -parseFloat(voucher.total_amount), trx);

        // Deduct inventory stock added during purchase
        for (const item of payload.items) {
          const newQty = await inventoryModel.upsertInventory(trx, item.productId, payload.warehouseId, -parseFloat(item.quantity));
          await inventoryModel.insertStockLog(trx, {
            product_id: item.productId,
            warehouse_id: payload.warehouseId,
            type: 'RETURN',
            quantity_change: -parseFloat(item.quantity),
            quantity_after: newQty,
            reference_id: id,
            reference_type: 'voucher',
            notes: `Reversal of purchase voucher ${voucher.voucher_number}`,
            created_by: userId
          });
        }
      } else if (type === 'SALES') {
        // Reduce customer AR balance
        await distModel.updateClientBalance(trx, payload.clientId, -parseFloat(voucher.total_amount));

        // Restore inventory stock deducted during sale
        for (const item of payload.items) {
          const newQty = await inventoryModel.upsertInventory(trx, item.productId, payload.warehouseId, parseFloat(item.quantity));
          await inventoryModel.insertStockLog(trx, {
            product_id: item.productId,
            warehouse_id: payload.warehouseId,
            type: 'RETURN',
            quantity_change: parseFloat(item.quantity),
            quantity_after: newQty,
            reference_id: id,
            reference_type: 'voucher',
            notes: `Reversal of sales voucher ${voucher.voucher_number}`,
            created_by: userId
          });
        }
      } else if (type === 'RECEIPT') {
        // Restore customer AR balance
        await distModel.updateClientBalance(trx, payload.clientId, parseFloat(voucher.total_amount));
      } else if (type === 'PAYMENT') {
        // Restore vendor AP balance
        await VendorModel.updateBalance(payload.vendorId, companyId, parseFloat(voucher.total_amount), trx);
      }

      // 6. Create a Reversal Voucher document
      const revVoucherNumber = `REV-${voucher.voucher_number}`;
      const [reversalVoucher] = await trx('vouchers')
        .insert({
          company_id: companyId,
          type: voucher.type,
          voucher_number: revVoucherNumber,
          date: reversalDate,
          status: 'POSTED',
          payload: { ...payload, is_reversal: true, reversed_voucher_id: id },
          total_amount: -parseFloat(voucher.total_amount),
          tax_amount: -parseFloat(voucher.tax_amount || 0),
          journal_entry_id: revEntryId,
          created_by: userId,
          approved_by: userId,
          is_reversed: false
        })
        .returning('*');

      // 7. Cross-link original voucher to reversal
      await trx('vouchers')
        .where({ id })
        .update({
          is_reversed: true,
          reversal_voucher_id: reversalVoucher.id,
          updated_at: trx.fn.now()
        });

      // 8. Log reversal in audit trail
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: id,
        action: 'REVERSE',
        user_id: userId,
        description: `Reversed voucher ${voucher.voucher_number}. Offset Journal Entry #${revEntryId} and Reversal Voucher ${revVoucherNumber} created.`
      });

      return { success: true, reversalVoucherId: reversalVoucher.id };
    });
  }
}

module.exports = VoucherService;
