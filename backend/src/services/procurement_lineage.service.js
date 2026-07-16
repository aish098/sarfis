const db = require('../config/db');

class ProcurementLineageService {
  static async getLineage(type, id, companyId) {
    let prId = null;
    let poIds = [];
    let grnIds = [];
    let pvIds = [];
    let payIds = [];

    // Helper to clean and deduplicate IDs
    const sanitizeIds = (arr) => [...new Set(arr.filter(Boolean).map(x => parseInt(x, 10)))];

    // Step 1: Resolve starting IDs depending on the document type
    if (type === 'PURCHASE_REQUISITION') {
      prId = parseInt(id, 10);
      const pos = await db('purchase_orders')
        .where({ purchase_requisition_id: prId, company_id: companyId })
        .select('id');
      poIds = pos.map(p => p.id);
    } else if (type === 'PURCHASE_ORDER') {
      const po = await db('purchase_orders').where({ id, company_id: companyId }).first();
      if (po) {
        poIds = [po.id];
        prId = po.purchase_requisition_id;
      }
    } else if (type === 'GOODS_RECEIPT') {
      const grn = await db('goods_receipts').where({ id, company_id: companyId }).first();
      if (grn) {
        grnIds = [grn.id];
        if (grn.purchase_order_id) {
          poIds = [grn.purchase_order_id];
          const po = await db('purchase_orders').where({ id: grn.purchase_order_id }).first();
          if (po) prId = po.purchase_requisition_id;
        }
      }
    } else if (type === 'VOUCHER') {
      const pv = await db('vouchers').where({ id, company_id: companyId, deleted_at: null }).first();
      if (pv) {
        if (pv.type === 'PURCHASE') {
          pvIds = [pv.id];
          if (pv.goods_receipt_id) {
            grnIds = [pv.goods_receipt_id];
            const grn = await db('goods_receipts').where({ id: pv.goods_receipt_id }).first();
            if (grn && grn.purchase_order_id) {
              poIds = [grn.purchase_order_id];
              const po = await db('purchase_orders').where({ id: grn.purchase_order_id }).first();
              if (po) prId = po.purchase_requisition_id;
            }
          } else if (pv.purchase_order_id) {
            poIds = [pv.purchase_order_id];
            const po = await db('purchase_orders').where({ id: pv.purchase_order_id }).first();
            if (po) prId = po.purchase_requisition_id;
          }
        } else if (pv.type === 'PAYMENT') {
          payIds = [pv.id];
          const pvId = pv.payload?.purchase_voucher_id;
          if (pvId) {
            pvIds = [pvId];
            const sourcePv = await db('vouchers').where({ id: pvId }).first();
            if (sourcePv) {
              if (sourcePv.goods_receipt_id) {
                grnIds = [sourcePv.goods_receipt_id];
                const grn = await db('goods_receipts').where({ id: sourcePv.goods_receipt_id }).first();
                if (grn && grn.purchase_order_id) {
                  poIds = [grn.purchase_order_id];
                  const po = await db('purchase_orders').where({ id: grn.purchase_order_id }).first();
                  if (po) prId = po.purchase_requisition_id;
                }
              } else if (sourcePv.purchase_order_id) {
                poIds = [sourcePv.purchase_order_id];
                const po = await db('purchase_orders').where({ id: sourcePv.purchase_order_id }).first();
                if (po) prId = po.purchase_requisition_id;
              }
            }
          }
        }
      }
    }

    // Step 2: Query other missing IDs in the sequence
    poIds = sanitizeIds(poIds);
    if (poIds.length > 0) {
      if (grnIds.length === 0) {
        const grns = await db('goods_receipts').whereIn('purchase_order_id', poIds).select('id');
        grnIds = grns.map(g => g.id);
      }
      grnIds = sanitizeIds(grnIds);

      if (pvIds.length === 0) {
        let query = db('vouchers').where({ type: 'PURCHASE', deleted_at: null });
        if (grnIds.length > 0) {
          query = query.where(q => {
            q.whereIn('purchase_order_id', poIds).orWhereIn('goods_receipt_id', grnIds);
          });
        } else {
          query = query.whereIn('purchase_order_id', poIds);
        }
        const pvs = await query.select('id');
        pvIds = pvs.map(p => p.id);
      }
    } else if (prId) {
      const pos = await db('purchase_orders').where({ purchase_requisition_id: prId, company_id: companyId }).select('id');
      poIds = sanitizeIds(pos.map(p => p.id));
      if (poIds.length > 0) {
        const grns = await db('goods_receipts').whereIn('purchase_order_id', poIds).select('id');
        grnIds = sanitizeIds(grns.map(g => g.id));

        let query = db('vouchers').where({ type: 'PURCHASE', deleted_at: null });
        if (grnIds.length > 0) {
          query = query.where(q => {
            q.whereIn('purchase_order_id', poIds).orWhereIn('goods_receipt_id', grnIds);
          });
        } else {
          query = query.whereIn('purchase_order_id', poIds);
        }
        const pvs = await query.select('id');
        pvIds = pvs.map(p => p.id);
      }
    }

    pvIds = sanitizeIds(pvIds);
    grnIds = sanitizeIds(grnIds);

    if (pvIds.length > 0 && payIds.length === 0) {
      const pays = await db('vouchers')
        .where({ type: 'PAYMENT', company_id: companyId, deleted_at: null })
        .whereIn(db.raw("cast(payload->>'purchase_voucher_id' as integer)"), pvIds)
        .select('id');
      payIds = sanitizeIds(pays.map(p => p.id));
    }

    // Step 3: Fetch full details for all identified documents
    const documents = [];

    if (prId) {
      const pr = await db('purchase_requisitions').where({ id: prId }).first();
      if (pr) {
        documents.push({
          type: 'PURCHASE_REQUISITION',
          id: pr.id,
          number: pr.requisition_number,
          status: pr.status,
          created_at: pr.created_at,
          link: `/dashboard/purchase-requisitions?id=${pr.id}`
        });
      }
    }

    if (poIds.length > 0) {
      const pos = await db('purchase_orders').whereIn('id', poIds).orderBy('id', 'asc');
      pos.forEach(po => {
        documents.push({
          type: 'PURCHASE_ORDER',
          id: po.id,
          number: po.po_number,
          status: po.status,
          created_at: po.created_at,
          link: `/dashboard/purchase-orders?id=${po.id}`
        });
      });
    }

    if (grnIds.length > 0) {
      const grns = await db('goods_receipts').whereIn('id', grnIds).orderBy('id', 'asc');
      grns.forEach(grn => {
        documents.push({
          type: 'GOODS_RECEIPT',
          id: grn.id,
          number: grn.grn_number,
          status: grn.status,
          created_at: grn.created_at,
          link: `/dashboard/goods-receipts?id=${grn.id}`
        });
      });
    }

    if (pvIds.length > 0) {
      const pvs = await db('vouchers').whereIn('id', pvIds).orderBy('id', 'asc');
      pvs.forEach(pv => {
        documents.push({
          type: 'VOUCHER',
          id: pv.id,
          number: pv.voucher_number,
          status: pv.status,
          created_at: pv.created_at,
          link: `/dashboard/vouchers/details/${pv.id}`
        });
      });
    }

    if (payIds.length > 0) {
      const pays = await db('vouchers').whereIn('id', payIds).orderBy('id', 'asc');
      pays.forEach(pay => {
        documents.push({
          type: 'PAYMENT',
          id: pay.id,
          number: pay.voucher_number,
          status: pay.status,
          created_at: pay.created_at,
          link: `/dashboard/vouchers/details/${pay.id}`
        });
      });
    }

    return documents;
  }
}

module.exports = ProcurementLineageService;
