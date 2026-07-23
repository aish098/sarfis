const db = require('../config/db');

class CorrectionWorkflowService {
  constructor() {
    this.handlers = new Map();
  }

  registerHandler(documentType, handler) {
    this.handlers.set(documentType.toUpperCase(), handler);
  }

  getHandler(documentType) {
    const key = documentType.toUpperCase();
    const handler = this.handlers.get(key);
    if (!handler) {
      const err = new Error(`UNSUPPORTED_CORRECTION_DOCUMENT_TYPE: Correction is not supported for ${documentType}.`);
      err.statusCode = 400;
      throw err;
    }
    return handler;
  }

  /**
   * Requests a correction for any supported ERP document type
   */
  async requestCorrection({ companyId, userId, documentType, documentId, reasonCode, reasonText }) {
    if (!reasonCode || !reasonText || reasonText.trim().length < 5) {
      throw new Error('A valid reason code and explanation (at least 5 characters) is required.');
    }

    const handler = this.getHandler(documentType);

    return await db.transaction(async (trx) => {
      const document = await handler.loadDocument({ trx, companyId, documentId, forUpdate: true });

      // Check for active correction request
      const activeReq = await trx('document_correction_requests')
        .where({ company_id: companyId, document_type: documentType.toUpperCase(), document_id: documentId })
        .whereIn('status', ['PENDING_APPROVAL', 'APPROVED', 'EXECUTING'])
        .first();

      if (activeReq) {
        const err = new Error(`An active correction request already exists for this ${documentType}.`);
        err.statusCode = 409;
        throw err;
      }

      await handler.validateRequest({ trx, companyId, userId, document, reasonCode, reasonText });

      const [inserted] = await trx('document_correction_requests')
        .insert({
          company_id: companyId,
          document_type: documentType.toUpperCase(),
          document_id: documentId,
          reason_code: reasonCode,
          reason_text: reasonText.trim(),
          requested_by: userId,
          status: 'PENDING_APPROVAL'
        })
        .returning('id');

      const requestId = typeof inserted === 'object' ? inserted.id : inserted;

      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'CORRECTION_REQUESTED',
        user_id: userId,
        description: `Requested correction for ${documentType} #${documentId} (Reason: [${reasonCode}] ${reasonText})`
      });

      return requestId;
    });
  }

  /**
   * Approves a pending correction request
   */
  async approveCorrectionRequest({ companyId, userId, requestId, allowSelfApproval = false }) {
    return await db.transaction(async (trx) => {
      const req = await trx('document_correction_requests')
        .where({ id: requestId, company_id: companyId })
        .forUpdate()
        .first();

      if (!req) {
        const err = new Error('Correction request not found.');
        err.statusCode = 404;
        throw err;
      }

      if (req.status !== 'PENDING_APPROVAL') {
        const err = new Error(`Cannot approve correction request in '${req.status}' state.`);
        err.statusCode = 409;
        throw err;
      }

      // Segregation of duties enforcement
      if (!allowSelfApproval && parseInt(req.requested_by, 10) === parseInt(userId, 10)) {
        const err = new Error('The correction requester cannot approve their own correction request.');
        err.statusCode = 403;
        err.code = 'SEGREGATION_OF_DUTIES';
        throw err;
      }

      // Compare-and-set status transition
      const updated = await trx('document_correction_requests')
        .where({ id: requestId, company_id: companyId, status: 'PENDING_APPROVAL' })
        .update({
          status: 'APPROVED',
          approved_by: userId,
          approved_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

      if (updated !== 1) {
        const err = new Error('INVALID_CORRECTION_REQUEST_STATE: The correction request is no longer pending approval.');
        err.statusCode = 409;
        throw err;
      }

      return true;
    });
  }

  /**
   * Rejects a pending correction request
   */
  async rejectCorrectionRequest({ companyId, userId, requestId, rejectionReason }) {
    return await db.transaction(async (trx) => {
      const req = await trx('document_correction_requests')
        .where({ id: requestId, company_id: companyId })
        .forUpdate()
        .first();

      if (!req) {
        const err = new Error('Correction request not found.');
        err.statusCode = 404;
        throw err;
      }

      if (req.status !== 'PENDING_APPROVAL') {
        const err = new Error(`Cannot reject correction request in '${req.status}' state.`);
        err.statusCode = 409;
        throw err;
      }

      const updated = await trx('document_correction_requests')
        .where({ id: requestId, company_id: companyId, status: 'PENDING_APPROVAL' })
        .update({
          status: 'REJECTED',
          rejected_by: userId,
          rejected_at: trx.fn.now(),
          rejection_reason: rejectionReason || 'Correction request denied by approver.',
          updated_at: trx.fn.now()
        });

      if (updated !== 1) {
        const err = new Error('INVALID_CORRECTION_REQUEST_STATE: The correction request is no longer pending approval.');
        err.statusCode = 409;
        throw err;
      }

      return true;
    });
  }

  /**
   * Executes an approved correction request
   */
  async executeCorrectionRequest({ companyId, userId, requestId }) {
    try {
      return await db.transaction(async (trx) => {
        const req = await trx('document_correction_requests')
          .where({ id: requestId, company_id: companyId })
          .forUpdate()
          .first();

        if (!req) {
          const err = new Error('Correction request not found.');
          err.statusCode = 404;
          throw err;
        }

        // Idempotency check
        if (req.status === 'EXECUTED') {
          return {
            idempotent: true,
            reversalDocumentId: req.reversal_document_id,
            reversalJournalEntryId: req.reversal_journal_entry_id,
            correctedDocumentId: req.corrected_document_id
          };
        }

        if (req.status !== 'APPROVED') {
          const err = new Error(`Only APPROVED correction requests can be executed (Current status: ${req.status}).`);
          err.statusCode = 409;
          throw err;
        }

        // Compare-and-set transition APPROVED -> EXECUTING
        const execTransition = await trx('document_correction_requests')
          .where({ id: requestId, company_id: companyId, status: 'APPROVED' })
          .update({
            status: 'EXECUTING',
            execution_attempts: (req.execution_attempts || 0) + 1,
            updated_at: trx.fn.now()
          });

        if (execTransition !== 1) {
          const err = new Error('INVALID_CORRECTION_REQUEST_STATE: Correction request is no longer approved.');
          err.statusCode = 409;
          throw err;
        }

        const handler = this.getHandler(req.document_type);

        // Lock target document
        const document = await handler.loadDocument({ trx, companyId, documentId: req.document_id, forUpdate: true });

        // Validate execution dependencies (payments, reconciliations, tax settlements, open periods)
        await handler.validateExecution({ trx, companyId, userId, request: req, document });

        // Execute Sub-ledger & GL Reversals
        const reversal = await handler.executeReversal({ trx, companyId, userId, request: req, document });

        // Create Replacement Draft Copy
        const correctedDraft = await handler.createReplacementDraft({ trx, companyId, userId, request: req, document, reversal });

        // Finalize links on original document (setting correction_draft_id & is_reversed: true)
        await handler.finalizeOriginal({ trx, companyId, userId, request: req, document, reversal, correctedDraft });

        // Finalize correction request EXECUTED
        await trx('document_correction_requests')
          .where({ id: requestId })
          .update({
            status: 'EXECUTED',
            executed_by: userId,
            executed_at: trx.fn.now(),
            reversal_document_id: reversal.reversalDocumentId,
            reversal_journal_entry_id: reversal.reversalJournalEntryId,
            corrected_document_id: correctedDraft.id,
            updated_at: trx.fn.now()
          });

        // Audit Trail
        await trx('transaction_audit_logs').insert({
          company_id: companyId,
          action: 'CORRECTION_EXECUTED',
          user_id: userId,
          description: `Executed Correction for ${req.document_type} #${req.document_id}. Reversal Document #${reversal.reversalDocumentId} & Draft Copy #${correctedDraft.id} created.`
        });

        // Outbox Notification
        const NotificationOutboxService = require('./notification_outbox.service');
        await NotificationOutboxService.enqueueNotification({
          companyId,
          eventType: `${req.document_type}_CORRECTION_EXECUTED`,
          aggregateType: req.document_type,
          aggregateId: req.document_id,
          payload: {
            correctionRequestId: req.id,
            reversalDocumentId: reversal.reversalDocumentId,
            reversalJournalEntryId: reversal.reversalJournalEntryId,
            correctedDocumentId: correctedDraft.id,
            userIds: [req.requested_by, document.created_by || document.user_id]
          },
          trx
        });

        return {
          idempotent: false,
          reversalDocumentId: reversal.reversalDocumentId,
          reversalJournalEntryId: reversal.reversalJournalEntryId,
          correctedDocumentId: correctedDraft.id
        };
      });
    } catch (err) {
      await db('document_correction_requests')
        .where({ id: requestId })
        .update({
          status: 'FAILED',
          execution_error: err.message,
          updated_at: db.fn.now()
        });
      throw err;
    }
  }
}

const orchestrator = new CorrectionWorkflowService();

// Register Journal Correction Handler
const JournalCorrectionHandler = require('./handlers/journal_correction.handler');
orchestrator.registerHandler('JOURNAL', new JournalCorrectionHandler());
orchestrator.registerHandler('JOURNAL_ENTRY', new JournalCorrectionHandler());

// Register Voucher Correction Handler
const VoucherCorrectionHandler = require('./handlers/voucher_correction.handler');
const voucherHandler = new VoucherCorrectionHandler();
orchestrator.registerHandler('PURCHASE_VOUCHER', voucherHandler);
orchestrator.registerHandler('SALES_VOUCHER', voucherHandler);
orchestrator.registerHandler('PURCHASE', voucherHandler);
orchestrator.registerHandler('SALES', voucherHandler);

module.exports = orchestrator;
