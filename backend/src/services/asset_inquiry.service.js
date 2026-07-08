const db = require('../config/db');

class AssetInquiryService {
  /**
   * Loads a comprehensive, 360-degree view DTO for a specific asset.
   */
  static async getAssetInquiryDetails(assetId, companyId) {
    // 1. Fetch Asset Master Record with Category details
    const asset = await db('assets as a')
      .leftJoin('asset_categories as c', 'a.category_id', 'c.id')
      .leftJoin('warehouses as w', 'a.location_id', 'w.id')
      .leftJoin('employees as e', 'a.custodian_employee_id', 'e.id')
      .where({ 'a.id': assetId, 'a.company_id': companyId })
      .select(
        'a.*',
        'c.category_name as category_name',
        'c.asset_account_id',
        'c.accumulated_depreciation_account_id',
        'c.depreciation_expense_account_id',
        'w.name as location_name',
        'e.name as custodian_name'
      )
      .first();

    if (!asset) {
      throw new Error(`Asset not found or access denied.`);
    }

    // Convert decimal strings to floats
    asset.purchase_cost = parseFloat(asset.purchase_cost || 0);
    asset.estimated_total_units = asset.estimated_total_units ? parseFloat(asset.estimated_total_units) : null;
    asset.current_units_used = parseFloat(asset.current_units_used || 0);
    asset.remaining_units = asset.remaining_units ? parseFloat(asset.remaining_units) : null;
    asset.last_revaluation_amount = asset.last_revaluation_amount ? parseFloat(asset.last_revaluation_amount) : null;

    // 2. Fetch Depreciation Books
    const depreciationBooks = await db('asset_depreciation_books')
      .where({ asset_id: assetId, company_id: companyId })
      .select('*')
      .orderBy('book_name', 'asc');

    depreciationBooks.forEach(book => {
      book.salvage_value = parseFloat(book.salvage_value || 0);
      book.accumulated_depreciation = parseFloat(book.accumulated_depreciation || 0);
      book.current_book_value = parseFloat(book.current_book_value || 0);
    });

    // 3. Fetch Asset Sub-Ledger Entries
    const ledger = await db('asset_ledger as al')
      .leftJoin('users as u', 'al.created_by', 'u.id')
      .leftJoin('vouchers as v', 'al.voucher_id', 'v.id')
      .leftJoin('journal_entries as je', 'al.journal_entry_id', 'je.id')
      .where({ 'al.asset_id': assetId, 'al.company_id': companyId })
      .select(
        'al.*',
        'u.name as created_by_name',
        'v.voucher_number',
        'je.id as entry_number'
      )
      .orderBy('al.event_date', 'asc')
      .orderBy('al.created_at', 'asc');

    ledger.forEach(entry => {
      entry.amount = parseFloat(entry.amount || 0);
    });

    // 4. Fetch Usage Logs (Meter Readings for Units of Production)
    const usageLogs = await db('asset_usage_logs as ul')
      .leftJoin('users as u', 'ul.created_by', 'u.id')
      .where({ 'ul.asset_id': assetId, 'ul.company_id': companyId })
      .select('ul.*', 'u.name as created_by_name')
      .orderBy('ul.usage_date', 'desc')
      .orderBy('ul.created_at', 'desc');

    usageLogs.forEach(log => {
      log.units_used = parseFloat(log.units_used || 0);
    });

    // 5. Build future-ready structures for maintenance, transfers, and revaluations
    const maintenance = []; // Reserved for future Asset Maintenance module
    const transfers = [];   // Reserved for future Asset Transfer module
    const revaluation = []; // Reserved for future Revaluation runs

    // 6. Fetch Disposal Details if the asset status is DISPOSED or SOLD
    let disposal = null;
    if (asset.status === 'DISPOSED' || asset.status === 'SOLD') {
      const disposalLedgerEntry = ledger.find(e => e.event_type === 'DISPOSAL' || e.event_type === 'SALE');
      if (disposalLedgerEntry) {
        disposal = {
          disposalDate: disposalLedgerEntry.event_date,
          reason: disposalLedgerEntry.description,
          salvageProceeds: disposalLedgerEntry.amount,
          voucherId: disposalLedgerEntry.voucher_id,
          voucherNumber: disposalLedgerEntry.voucher_number,
          journalEntryId: disposalLedgerEntry.journal_entry_id,
          journalEntryNumber: disposalLedgerEntry.entry_number
        };
      }
    }

    // 7. Load Audit Trails from transaction_audit_logs linked to asset's acquisition or disposal
    const voucherIds = ledger.map(l => l.voucher_id).filter(id => id !== null);
    let audit = [];
    if (voucherIds.length > 0) {
      audit = await db('transaction_audit_logs as tal')
        .leftJoin('users as u', 'tal.user_id', 'u.id')
        .whereIn('tal.voucher_id', voucherIds)
        .select('tal.*', 'u.name as user_name')
        .orderBy('tal.created_at', 'desc');
    }

    return {
      asset,
      depreciationBooks,
      ledger,
      usageLogs,
      maintenance,
      transfers,
      revaluation,
      disposal,
      audit
    };
  }
}

module.exports = AssetInquiryService;
