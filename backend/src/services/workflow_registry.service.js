const db = require('../config/db');

class WorkflowRegistryService {
  /**
   * Invokes the registered callback for a completed workflow document.
   */
  static async executeCallback(docTypeCode, docId, companyId, action = 'APPROVE', userId = null, trx = db) {
    let docType = await trx('workflow_document_types')
      .where({ code: docTypeCode })
      .first();

    if (!docType) {
      if (docTypeCode === 'VOUCHER') {
        const [newDoc] = await trx('workflow_document_types')
          .insert({
            code: 'VOUCHER',
            name: 'ERP Voucher (Sales, Purchase, etc.)',
            callback_service: 'voucher.service',
            callback_method: 'postToLedger'
          })
          .returning('*');
        docType = newDoc;
      } else if (docTypeCode === 'JOURNAL') {
        const [newDoc] = await trx('workflow_document_types')
          .insert({
            code: 'JOURNAL',
            name: 'Manual Journal Entry',
            callback_service: 'journal.service',
            callback_method: 'postJournalEntry'
          })
          .returning('*');
        docType = newDoc;
      } else if (docTypeCode === 'PERIOD_CLOSE') {
        const [newDoc] = await trx('workflow_document_types')
          .insert({
            code: 'PERIOD_CLOSE',
            name: 'Accounting Period Close',
            callback_service: 'period_close.service',
            callback_method: 'closePeriod'
          })
          .returning('*');
        docType = newDoc;
      } else if (docTypeCode === 'BUDGET') {
        const [newDoc] = await trx('workflow_document_types')
          .insert({
            code: 'BUDGET',
            name: 'Budget Plan Approval',
            callback_service: 'budget.service',
            callback_method: 'activateBudget'
          })
          .returning('*');
        docType = newDoc;
      } else {
        throw new Error(`Document type '${docTypeCode}' is not registered in the workflow registry.`);
      }
    }

    const { callback_service, callback_method } = docType;
    console.log(`[WORKFLOW CALLBACK] Executing callback for ${docTypeCode} #${docId}: ${callback_service}.${callback_method} (Action: ${action}, User: ${userId})`);

    // Dynamically require and call the target service
    let service;
    try {
      service = require(`./${callback_service}`);
    } catch (err) {
      service = require(`./${callback_service.toLowerCase()}`);
    }

    if (!service || typeof service[callback_method] !== 'function') {
      throw new Error(`Callback handler '${callback_service}.${callback_method}' is not a valid service function.`);
    }

    // Call the service callback with parameters (id, companyId, userId, trx)
    return await service[callback_method](docId, companyId, userId, trx);
  }
}

module.exports = WorkflowRegistryService;
