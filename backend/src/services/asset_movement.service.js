const db = require('../config/db');
const PostingEngineService = require('./posting_engine.service');

const extractId = (insertResult) => {
  if (!insertResult || insertResult.length === 0) return null;
  const first = insertResult[0];
  return typeof first === 'object' && first !== null ? first.id : first;
};

class AssetMovementService {
  // =========================================================================
  // TRANSFERS PIPELINE
  // =========================================================================

  static async requestTransfer(companyId, userId, data) {
    const asset = await db('assets').where({ id: data.asset_id, company_id: companyId }).first();
    if (!asset) throw new Error('Asset not found.');

    const insertResult = await db('asset_transfer_requests')
      .insert({
        company_id: companyId,
        asset_id: data.asset_id,
        from_location_id: asset.location_id,
        to_location_id: data.to_location_id ? parseInt(data.to_location_id) : null,
        from_custodian_employee_id: asset.custodian_employee_id,
        to_custodian_employee_id: data.to_custodian_employee_id ? parseInt(data.to_custodian_employee_id) : null,
        transfer_date: data.transfer_date || new Date().toISOString().split('T')[0],
        notes: data.notes || '',
        status: 'PENDING',
        created_by: userId
      })
      .returning('id');

    const id = extractId(insertResult);
    return { id, message: 'Transfer request submitted and pending approval.' };
  }

  static async getTransferRequests(companyId, status) {
    const query = db('asset_transfer_requests as r')
      .leftJoin('assets as a', 'r.asset_id', 'a.id')
      .leftJoin('warehouses as wfrom', 'r.from_location_id', 'wfrom.id')
      .leftJoin('warehouses as wto', 'r.to_location_id', 'wto.id')
      .leftJoin('employees as efrom', 'r.from_custodian_employee_id', 'efrom.id')
      .leftJoin('employees as eto', 'r.to_custodian_employee_id', 'eto.id')
      .leftJoin('users as u', 'r.created_by', 'u.id')
      .where({ 'r.company_id': companyId });

    if (status) {
      query.andWhere('r.status', status);
    }

    return await query.select(
      'r.*',
      'a.asset_name',
      'a.asset_code',
      'wfrom.name as from_location_name',
      'wto.name as to_location_name',
      'efrom.name as from_custodian_name',
      'eto.name as to_custodian_name',
      'u.name as requested_by_name'
    ).orderBy('r.created_at', 'desc');
  }

  static async approveTransfer(companyId, userId, requestId) {
    return await db.transaction(async trx => {
      const req = await trx('asset_transfer_requests').where({ id: requestId, company_id: companyId }).first();
      if (!req) throw new Error('Transfer request not found.');
      if (req.status !== 'PENDING') throw new Error('Request is already processed.');

      // Update Asset Record
      await trx('assets')
        .where({ id: req.asset_id })
        .update({
          location_id: req.to_location_id,
          custodian_employee_id: req.to_custodian_employee_id,
          updated_at: trx.fn.now()
        });

      // Insert completed log
      await trx('asset_transfers').insert({
        company_id: companyId,
        asset_id: req.asset_id,
        request_id: req.id,
        from_location_id: req.from_location_id,
        to_location_id: req.to_location_id,
        from_custodian_employee_id: req.from_custodian_employee_id,
        to_custodian_employee_id: req.to_custodian_employee_id,
        transfer_date: req.transfer_date,
        notes: req.notes,
        created_by: req.created_by
      });

      // Update request status
      await trx('asset_transfer_requests')
        .where({ id: req.id })
        .update({
          status: 'APPROVED',
          approved_by: userId,
          updated_at: trx.fn.now()
        });

      // Fetch metadata names
      let fromLoc = 'Unassigned', toLoc = 'Unassigned';
      if (req.from_location_id) {
        const w = await trx('warehouses').where({ id: req.from_location_id }).first();
        if (w) fromLoc = w.name;
      }
      if (req.to_location_id) {
        const w = await trx('warehouses').where({ id: req.to_location_id }).first();
        if (w) toLoc = w.name;
      }
      let fromCust = 'Unassigned', toCust = 'Unassigned';
      if (req.from_custodian_employee_id) {
        const e = await trx('employees').where({ id: req.from_custodian_employee_id }).first();
        if (e) fromCust = e.name;
      }
      if (req.to_custodian_employee_id) {
        const e = await trx('employees').where({ id: req.to_custodian_employee_id }).first();
        if (e) toCust = e.name;
      }

      const reqUser = await trx('users').where({ id: req.created_by }).first();
      const appUser = await trx('users').where({ id: userId }).first();

      // Write Ledger record
      await trx('asset_ledger').insert({
        company_id: companyId,
        asset_id: req.asset_id,
        event_type: 'TRANSFER',
        event_date: req.transfer_date,
        description: `Transfer Approved: Route [${fromLoc} ➔ ${toLoc}], Custody [${fromCust} ➔ ${toCust}]. Requested By: ${reqUser?.name || 'System'}, Approved By: ${appUser?.name || 'Manager'}. Reason: ${req.notes || 'None'}`,
        amount: 0.00,
        created_by: userId
      });

      return { success: true };
    });
  }

  static async rejectTransfer(companyId, userId, requestId) {
    await db('asset_transfer_requests')
      .where({ id: requestId, company_id: companyId })
      .update({
        status: 'REJECTED',
        approved_by: userId,
        updated_at: db.fn.now()
      });
    return { success: true };
  }

  // =========================================================================
  // WORK ORDERS PIPELINE
  // =========================================================================

  static async createWorkOrder(companyId, userId, data) {
    const asset = await db('assets').where({ id: data.asset_id, company_id: companyId }).first();
    if (!asset) throw new Error('Asset not found.');

    const seq = Math.floor(1000 + Math.random() * 9000);
    const woNum = `WO-${asset.asset_code}-${seq}`;

    const insertResult = await db('asset_work_orders')
      .insert({
        company_id: companyId,
        asset_id: data.asset_id,
        work_order_number: woNum,
        maintenance_type: data.maintenance_type || 'PREVENTIVE',
        description: data.description || '',
        technician_name: data.technician_name || '',
        parts_used: data.parts_used || '',
        labor_cost: parseFloat(data.labor_cost || 0),
        maintenance_cost: parseFloat(data.maintenance_cost || 0),
        maintenance_date: data.maintenance_date || new Date().toISOString().split('T')[0],
        next_scheduled_date: data.next_scheduled_date || null,
        status: data.status || 'OPEN',
        created_by: userId
      })
      .returning('id');

    const id = extractId(insertResult);

    // If initial status is COMPLETED, log to ledger immediately
    if (data.status === 'COMPLETED') {
      await db('asset_ledger').insert({
        company_id: companyId,
        asset_id: data.asset_id,
        event_type: 'MAINTENANCE',
        event_date: data.maintenance_date || new Date().toISOString().split('T')[0],
        description: `Work Order ${woNum} Completed: [${data.maintenance_type}] - ${data.description}. Parts: ${data.parts_used || 'None'}, Labor cost: PKR ${parseFloat(data.labor_cost || 0).toLocaleString()}, Material cost: PKR ${parseFloat(data.maintenance_cost || 0).toLocaleString()}`,
        amount: parseFloat(data.maintenance_cost || 0) + parseFloat(data.labor_cost || 0),
        created_by: userId
      });
    }

    return { id, workOrderNumber: woNum };
  }

  static async getWorkOrders(companyId, status) {
    const query = db('asset_work_orders as wo')
      .leftJoin('assets as a', 'wo.asset_id', 'a.id')
      .leftJoin('users as u', 'wo.created_by', 'u.id')
      .where({ 'wo.company_id': companyId });

    if (status) {
      query.andWhere('wo.status', status);
    }

    return await query.select(
      'wo.*',
      'a.asset_name',
      'a.asset_code',
      'u.name as creator_name'
    ).orderBy('wo.created_at', 'desc');
  }

  static async updateWorkOrder(companyId, userId, id, data) {
    return await db.transaction(async trx => {
      const wo = await trx('asset_work_orders').where({ id, company_id: companyId }).first();
      if (!wo) throw new Error('Work order not found.');

      const isTransitioningToComplete = data.status === 'COMPLETED' && wo.status !== 'COMPLETED';

      await trx('asset_work_orders')
        .where({ id })
        .update({
          status: data.status,
          technician_name: data.technician_name,
          parts_used: data.parts_used,
          labor_cost: parseFloat(data.labor_cost || 0),
          maintenance_cost: parseFloat(data.maintenance_cost || 0),
          next_scheduled_date: data.next_scheduled_date || null,
          updated_at: trx.fn.now()
        });

      if (isTransitioningToComplete) {
        // Log to ledger
        const total = parseFloat(data.maintenance_cost || 0) + parseFloat(data.labor_cost || 0);
        await trx('asset_ledger').insert({
          company_id: companyId,
          asset_id: wo.asset_id,
          event_type: 'MAINTENANCE',
          event_date: new Date().toISOString().split('T')[0],
          description: `Work Order ${wo.work_order_number} Completed: [${wo.maintenance_type}] - ${wo.description}. Tech: ${data.technician_name || 'N/A'}, Labor Cost: PKR ${parseFloat(data.labor_cost || 0).toLocaleString()}, Material Cost: PKR ${parseFloat(data.maintenance_cost || 0).toLocaleString()}`,
          amount: total,
          created_by: userId
        });
      }

      return { success: true };
    });
  }

  // =========================================================================
  // DISPOSALS LIFECYCLE
  // =========================================================================

  static async disposeAsset(companyId, userId, data) {
    return await db.transaction(async trx => {
      const asset = await trx('assets')
        .where({ id: data.asset_id, company_id: companyId })
        .first();

      if (!asset) throw new Error('Asset not found.');
      if (asset.status === 'DISPOSED' || asset.status === 'SOLD') {
        throw new Error('Asset has already been retired.');
      }

      const book = await trx('asset_depreciation_books')
        .where({ asset_id: data.asset_id, book_name: 'Accounting', company_id: companyId })
        .first();
      
      const category = await trx('asset_categories')
        .where({ id: asset.category_id, company_id: companyId })
        .first();

      if (!book || !category) throw new Error('Asset mappings or books are missing.');

      const cost = parseFloat(asset.purchase_cost);
      const accDep = parseFloat(book.accumulated_depreciation);
      const bookValue = parseFloat(book.current_book_value);
      const proceeds = parseFloat(data.proceeds_amount || 0);
      const gainLoss = proceeds - bookValue;

      const companySettings = await db('company_accounting_settings')
        .where({ company_id: companyId })
        .first();

      const cashAccount = companySettings?.default_cash_account_id;
      const disposalGainLossAccount = companySettings?.default_cogs_account_id;

      if (!category.asset_account_id || !category.accumulated_depreciation_account_id || !disposalGainLossAccount) {
        throw new Error('Asset, Accumulated Depreciation, or Disposal Gain/Loss accounts are missing.');
      }

      const journalLines = [
        { accountId: category.asset_account_id, debit: 0, credit: cost }
      ];

      if (accDep > 0) {
        journalLines.push({ accountId: category.accumulated_depreciation_account_id, debit: accDep, credit: 0 });
      }

      if (proceeds > 0) {
        if (!cashAccount) throw new Error('Default Cash Account mapping is missing.');
        journalLines.push({ accountId: cashAccount, debit: proceeds, credit: 0 });
      }

      if (gainLoss > 0) {
        journalLines.push({ accountId: disposalGainLossAccount, debit: 0, credit: gainLoss });
      } else if (gainLoss < 0) {
        journalLines.push({ accountId: disposalGainLossAccount, debit: -gainLoss, credit: 0 });
      }

      // Query Sequence
      const seqRecord = await trx('voucher_sequences')
        .where({ company_id: companyId, type: 'JOURNAL' })
        .forUpdate()
        .first();

      const nextNum = seqRecord ? seqRecord.next_val : 1;
      if (seqRecord) {
        await trx('voucher_sequences')
          .where({ company_id: companyId, type: 'JOURNAL' })
          .update({ next_val: nextNum + 1 });
      }

      const prefix = seqRecord ? seqRecord.prefix : 'JV-';
      const voucherNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

      const voucherPayload = {
        date: data.disposal_date,
        notes: `Retirement (${data.disposal_type || 'Disposal'}) of Asset ${asset.asset_code}: ${data.disposal_reason}`,
        lines: journalLines
      };

      // Create Voucher
      const insertResult = await trx('vouchers')
        .insert({
          company_id: companyId,
          voucher_number: voucherNumber,
          type: 'JOURNAL',
          date: data.disposal_date,
          status: 'DRAFT',
          total_amount: Math.max(proceeds, cost),
          tax_amount: 0,
          created_by: userId,
          payload: voucherPayload
        })
        .returning('id');
      const voucherId = extractId(insertResult);

      // Post Transaction
      const { journalEntryId } = await PostingEngineService.postTransaction({
        type: 'JOURNAL',
        companyId,
        payload: voucherPayload,
        userId,
        voucherId
      }, trx);

      // Update Voucher status
      await trx('vouchers')
        .where({ id: voucherId })
        .update({ status: 'POSTED', updated_at: trx.fn.now() });

      // Update Asset Status to Disposed/Sold
      const newStatus = data.disposal_type === 'Sale' ? 'SOLD' : 'DISPOSED';
      await trx('assets')
        .where({ id: asset.id })
        .update({ status: newStatus, updated_at: trx.fn.now() });

      // Zero out books
      await trx('asset_depreciation_books')
        .where({ asset_id: asset.id })
        .update({ current_book_value: 0.00, updated_at: trx.fn.now() });

      // Write sub-ledger record
      await trx('asset_ledger').insert({
        company_id: companyId,
        asset_id: asset.id,
        event_type: data.disposal_type === 'Sale' ? 'SALE' : 'DISPOSAL',
        event_date: data.disposal_date,
        description: `Disposal Type: ${data.disposal_type || 'Disposal'}. Reason: ${data.disposal_reason}. Cost: PKR ${cost.toLocaleString()}, Acc Dep: PKR ${accDep.toLocaleString()}, Proceeds: PKR ${proceeds.toLocaleString()}, Gain/Loss: PKR ${gainLoss.toLocaleString()}. Voucher: ${voucherNumber}`,
        amount: proceeds,
        voucher_id: voucherId,
        journal_entry_id: journalEntryId,
        created_by: userId
      });

      return { voucherNumber, gainLoss };
    });
  }
}

module.exports = AssetMovementService;
