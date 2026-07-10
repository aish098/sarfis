const db = require('../config/db');

class WorkflowRegistryService {
  /**
   * Invokes the registered callback for a completed workflow document.
   */
  static async executeCallback(docTypeCode, docId, companyId, action = 'APPROVE', userId = null, trx = db) {
    const docType = await trx('workflow_document_types')
      .where({ code: docTypeCode })
      .first();

    if (!docType) {
      throw new Error(`Document type '${docTypeCode}' is not registered in the workflow registry.`);
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
