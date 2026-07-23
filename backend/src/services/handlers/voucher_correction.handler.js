const VendorModel = require('../../models/vendor.model');
const distModel = require('../../models/distribution.model');
const inventoryModel = require('../../models/inventory.model');
const JournalModel = require('../../models/journal.model');
const AccountModel = require('../../models/account.model');
const JournalPostingService = require('../journal_posting.service');
const PostingEngineService = require('../posting_engine.service');

class VoucherCorrectionHandler {
  async loadDocument({ trx, companyId, documentId, forUpdate = false }) {
    const query = trx('vouchers').where({ id: documentId, company_id: companyId, deleted_at: null });
    if (forUpdate) query.forUpdate();
    const voucher = await query.first();
    if (!voucher) {
      const err = new Error('Voucher not found.');
      err.statusCode = 404;
      throw err;
    }
    return voucher;
  }

  async validateRequest({ trx, companyId, userId, document, reasonCode, reasonText }) {
    if (document.status !== 'POSTED') {
      const err = new Error('Only posted vouchers can request a correction.');
      err.statusCode = 409;
      throw err;
    }
    if (document.is_reversed) {
      const err = new Error('This voucher has already been reversed.');
      err.statusCode = 409;
      throw err;
    }

    await this.checkDownstreamDependencies(trx, companyId, document);
  }

  async validateExecution({ trx, companyId, userId, request, document }) {
    if (document.status !== 'POSTED') throw new Error('Original voucher is no longer POSTED.');
    if (document.is_reversed) throw new Error('Original voucher is already marked REVERSED.');

    await this.checkDownstreamDependencies(trx, companyId, document);

    // Validate period close
    const reversalDate = new Date();
    await PostingEngineService.assertPeriodOpen(companyId, reversalDate, trx);
  }

  async checkDownstreamDependencies(trx, companyId, document) {
    if (document.status === 'PAID') {
      const err = new Error('DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES: Cannot correct voucher because it has been paid or settled.');
      err.statusCode = 409;
      err.code = 'DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES';
      throw err;
    }

    const type = document.type.toUpperCase();

    // Check for payment or receipt vouchers linked to this voucher
    if (type === 'PURCHASE') {
      const paymentVoucher = await trx('vouchers')
        .where({ company_id: companyId, type: 'PAYMENT', deleted_at: null })
        .whereRaw("payload->>'purchase_voucher_id' = ?", [String(document.id)])
        .whereIn('status', ['PENDING_APPROVAL', 'POSTED', 'PAID'])
        .first();

      if (paymentVoucher) {
        const err = new Error('DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES: Purchase voucher has active supplier payment transactions.');
        err.statusCode = 409;
        err.code = 'DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES';
        throw err;
      }
    } else if (type === 'SALES') {
      const receiptVoucher = await trx('vouchers')
        .where({ company_id: companyId, type: 'RECEIPT', deleted_at: null })
        .whereRaw("payload->>'sales_invoice_id' = ?", [String(document.id)])
        .whereIn('status', ['PENDING_APPROVAL', 'POSTED', 'PAID'])
        .first();

      if (receiptVoucher) {
        const err = new Error('DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES: Sales voucher has active customer receipt transactions.');
        err.statusCode = 409;
        err.code = 'DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES';
        throw err;
      }
    }
  }

  async executeReversal({ trx, companyId, userId, request, document }) {
    const reversalDate = new Date();
    const type = document.type.toUpperCase();
    const payload = document.payload || {};

    // 1. Sub-ledger Reversals (Party balances)
    if (type === 'PURCHASE') {
      if (payload.vendorId) {
        await VendorModel.updateBalance(payload.vendorId, companyId, -parseFloat(document.total_amount), trx);
      }
    } else if (type === 'SALES') {
      if (payload.clientId) {
        await distModel.updateClientBalance(trx, payload.clientId, -parseFloat(document.total_amount));
      }
    }

    // 2. GL Entry Reversal via Inverted Double Entries
    if (!document.journal_entry_id) throw new Error('Associated GL journal entry not found for this voucher.');

    const origLines = await trx('journal_lines').where({ entry_id: document.journal_entry_id });
    if (!origLines || origLines.length === 0) throw new Error('Original journal lines are empty.');

    const JournalService = require('../journal.service');
    const revEntryId = await JournalModel.createEntry({
      companyId,
      entryDate: reversalDate,
      description: `Correction Reversal of ${document.type} Voucher #${document.voucher_number}`,
      reference: `REV-${document.voucher_number}`,
      reversalOfId: document.journal_entry_id,
      reversalReason: request.reason_text,
      userId,
      status: 'DRAFT'
    }, trx);

    for (const line of origLines) {
      await JournalModel.createLine({
        entryId: revEntryId,
        accountId: line.account_id,
        debit: parseFloat(line.credit) || 0,
        credit: parseFloat(line.debit) || 0,
        department: line.department,
        project: line.project,
        branch: line.branch
      }, trx);
    }

    // Post reversal GL journal through canonical posting engine
    await JournalService.postJournalEntry(revEntryId, companyId, userId, true, trx);

    // 3. Create Reversal Voucher document
    const VoucherService = require('../voucher.service');
    const revVoucherNumber = await VoucherService.generateVoucherNumber(companyId, document.type, trx);

    const [reversalVoucher] = await trx('vouchers')
      .insert({
        company_id: companyId,
        type: document.type,
        voucher_number: revVoucherNumber,
        date: reversalDate,
        status: 'POSTED',
        payload: { ...payload, is_reversal: true, reversed_voucher_id: document.id },
        total_amount: -parseFloat(document.total_amount),
        tax_amount: -parseFloat(document.tax_amount || 0),
        journal_entry_id: revEntryId,
        reversal_of_voucher_id: document.id,
        reversal_journal_entry_id: revEntryId,
        created_by: userId,
        approved_by: userId,
        is_reversed: false
      })
      .returning('*');

    return {
      reversalDocumentId: reversalVoucher.id,
      reversalJournalEntryId: revEntryId
    };
  }

  async createReplacementDraft({ trx, companyId, userId, request, document, reversal }) {
    const VoucherService = require('../voucher.service');
    const draftVoucherNumber = await VoucherService.generateVoucherNumber(companyId, document.type, trx);

    const [draftVoucher] = await trx('vouchers')
      .insert({
        company_id: companyId,
        type: document.type,
        voucher_number: draftVoucherNumber,
        date: document.date,
        status: 'DRAFT',
        payload: { ...document.payload, is_corrected_copy: true, original_voucher_id: document.id },
        total_amount: parseFloat(document.total_amount),
        tax_amount: parseFloat(document.tax_amount || 0),
        correction_of_voucher_id: document.id,
        goods_receipt_id: document.goods_receipt_id || null,
        purchase_order_id: document.purchase_order_id || null,
        created_by: userId
      })
      .returning('*');

    return draftVoucher;
  }

  async finalizeOriginal({ trx, companyId, userId, request, document, reversal, correctedDraft }) {
    await trx('vouchers')
      .where({ id: document.id })
      .update({
        is_reversed: true,
        reversal_voucher_id: reversal.reversalDocumentId,
        reversal_journal_entry_id: reversal.reversalJournalEntryId,
        correction_draft_id: correctedDraft.id
      });
  }
}

module.exports = VoucherCorrectionHandler;
