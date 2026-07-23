const crypto = require('crypto');
const db = require('../config/db');

class DocumentRevisionService {
  /**
   * Builds a canonical JSON representation of a document for hashing and snapshot storage
   */
  static buildCanonicalSnapshot(documentType, header, items = []) {
    const canonicalHeader = {
      documentNumber: header.requisition_number || header.po_number || header.grn_number || header.voucher_number || header.entry_number || header.id,
      vendorId: header.vendor_id || header.vendorId || null,
      department: header.department || null,
      priority: header.priority || null,
      reason: header.reason || header.notes || null,
      date: header.required_date || header.date || header.received_date || null,
      totalAmount: parseFloat(header.estimated_total || header.total_amount || header.totalAmount || 0)
    };

    const canonicalItems = [...items]
      .sort((a, b) => Number(a.id || a.product_id || a.productId || 0) - Number(b.id || b.product_id || b.productId || 0))
      .map(item => ({
        productId: item.product_id || item.productId || null,
        quantity: parseFloat(item.quantity || item.quantity_received || 0),
        unitPrice: parseFloat(item.unit_purchase_price || item.unit_price || item.unit_cost || item.unitPurchasePrice || item.unitPrice || item.unitCost || 0),
        lineTotal: parseFloat(item.line_total || item.lineTotal || 0) || (parseFloat(item.quantity || 0) * parseFloat(item.unit_purchase_price || item.unit_price || item.unit_cost || 0)),
        description: item.description || item.notes || ''
      }));

    const payload = {
      documentType,
      header: canonicalHeader,
      items: canonicalItems
    };

    const payloadStr = JSON.stringify(payload);
    const contentHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    return { payload, contentHash };
  }

  /**
   * Saves an immutable snapshot into document_revisions
   */
  static async saveSnapshot({
    companyId,
    documentType,
    documentId,
    revisionNumber = 0,
    cycleNumber = 1,
    snapshotType = 'SUBMITTED', // 'SUBMITTED', 'REJECTED', 'RESUBMITTED', 'APPROVED', 'POSTED'
    previousStatus = 'DRAFT',
    newStatus = 'PENDING_APPROVAL',
    header,
    items = [],
    changeSummary = null,
    revisionNotes = null,
    userId,
    trx = db
  }) {
    const { payload, contentHash } = this.buildCanonicalSnapshot(documentType, header, items);

    const snapshotData = {
      company_id: companyId,
      document_type: documentType,
      document_id: documentId,
      revision_number: revisionNumber,
      cycle_number: cycleNumber,
      snapshot_type: snapshotType,
      previous_status: previousStatus,
      new_status: newStatus,
      snapshot_json: JSON.stringify(payload),
      content_hash: contentHash,
      change_summary: changeSummary || null,
      revision_notes: revisionNotes || null,
      created_by: userId
    };

    const queryExecutor = trx || db;
    await queryExecutor('document_revisions')
      .insert(snapshotData)
      .onConflict(['company_id', 'document_type', 'document_id', 'revision_number', 'snapshot_type'])
      .ignore();

    return { contentHash, snapshotData };
  }

  /**
   * Retrieves all historical revision snapshots for a document
   */
  static async getRevisions(companyId, documentType, documentId, trx = db) {
    const queryExecutor = trx || db;
    const revisions = await queryExecutor('document_revisions as dr')
      .leftJoin('users as u', 'dr.created_by', 'u.id')
      .where({ 'dr.company_id': companyId, 'dr.document_type': documentType, 'dr.document_id': documentId })
      .select('dr.*', 'u.name as creator_name')
      .orderBy('dr.revision_number', 'desc')
      .orderBy('dr.id', 'desc');

    return revisions.map(r => ({
      ...r,
      snapshot_json: typeof r.snapshot_json === 'string' ? JSON.parse(r.snapshot_json) : r.snapshot_json
    }));
  }
}

module.exports = DocumentRevisionService;
