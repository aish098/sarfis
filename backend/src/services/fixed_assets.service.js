const db = require('../config/db');
const PostingEngineService = require('./posting_engine.service');

const extractId = (insertResult) => {
  if (!insertResult || insertResult.length === 0) return null;
  const first = insertResult[0];
  return typeof first === 'object' && first !== null ? first.id : first;
};

class FixedAssetsService {
  // =========================================================================
  // CATEGORY CRUD
  // =========================================================================

  static async getCategories(companyId) {
    return await db('asset_categories')
      .where({ company_id: companyId })
      .orderBy('category_name', 'asc');
  }

  static async createCategory(companyId, data) {
    const insertResult = await db('asset_categories')
      .insert({
        company_id: companyId,
        category_name: data.category_name,
        default_useful_life_years: parseInt(data.default_useful_life_years || 5),
        default_depreciation_method: data.default_depreciation_method || 'STRAIGHT_LINE',
        default_salvage_percent: parseFloat(data.default_salvage_percent || 10),
        asset_account_id: data.asset_account_id || null,
        accumulated_depreciation_account_id: data.accumulated_depreciation_account_id || null,
        depreciation_expense_account_id: data.depreciation_expense_account_id || null
      })
      .returning('id');
    const id = extractId(insertResult);

    return await db('asset_categories').where({ id }).first();
  }

  static async updateCategory(companyId, id, data) {
    await db('asset_categories')
      .where({ id, company_id: companyId })
      .update({
        category_name: data.category_name,
        default_useful_life_years: parseInt(data.default_useful_life_years),
        default_depreciation_method: data.default_depreciation_method,
        default_salvage_percent: parseFloat(data.default_salvage_percent),
        asset_account_id: data.asset_account_id,
        accumulated_depreciation_account_id: data.accumulated_depreciation_account_id,
        depreciation_expense_account_id: data.depreciation_expense_account_id,
        updated_at: db.fn.now()
      });

    return await db('asset_categories').where({ id }).first();
  }

  // =========================================================================
  // ASSET CRUD
  // =========================================================================

  static async getAssets(companyId, status) {
    const query = db('assets as a')
      .leftJoin('asset_categories as c', 'a.category_id', 'c.id')
      .where({ 'a.company_id': companyId });

    if (status) {
      query.andWhere('a.status', status);
    }

    return await query
      .select('a.*', 'c.category_name')
      .orderBy('a.asset_code', 'asc');
  }

  static async createAsset(companyId, userId, data) {
    return await db.transaction(async trx => {
      const category = await trx('asset_categories')
        .where({ id: data.category_id, company_id: companyId })
        .first();
      
      if (!category) throw new Error('Asset category not found.');

      // Check unique asset code
      const exists = await trx('assets')
        .where({ company_id: companyId, asset_code: data.asset_code })
        .first();
      if (exists) throw new Error(`Asset code '${data.asset_code}' is already registered.`);

      const cost = parseFloat(data.purchase_cost);
      
      // Calculate units parameters if Units of Production
      let estTotalUnits = null;
      let remUnits = null;
      if (data.depreciation_method === 'UNITS_OF_PRODUCTION') {
        estTotalUnits = parseFloat(data.estimated_total_units || 0);
        remUnits = estTotalUnits;
      }

      const insertResult = await trx('assets')
        .insert({
          company_id: companyId,
          asset_code: data.asset_code,
          asset_name: data.asset_name,
          category_id: data.category_id,
          purchase_voucher_id: data.purchase_voucher_id || null,
          purchase_date: data.purchase_date,
          placed_in_service_date: data.placed_in_service_date,
          purchase_cost: cost,
          location_id: data.location_id || null,
          custodian_employee_id: data.custodian_employee_id || null,
          serial_number: data.serial_number || null,
          notes: data.notes || null,
          estimated_total_units: estTotalUnits,
          current_units_used: 0,
          remaining_units: remUnits,
          status: 'ACTIVE'
        })
        .returning('id');
      const assetId = extractId(insertResult);

      // Initialize all 3 Depreciation Books automatically to support multi-book accounting
      const books = ['Accounting', 'Tax', 'Management'];
      for (const bookName of books) {
        let salvage = parseFloat(data.salvage_value || 0);
        if (salvage === 0 && category.default_salvage_percent > 0) {
          salvage = (cost * parseFloat(category.default_salvage_percent)) / 100;
        }

        await trx('asset_depreciation_books').insert({
          company_id: companyId,
          asset_id: assetId,
          book_name: bookName,
          depreciation_method: data.depreciation_method || category.default_depreciation_method,
          useful_life_years: parseInt(data.useful_life_years || category.default_useful_life_years),
          useful_life_months: parseInt(data.useful_life_years || category.default_useful_life_years) * 12,
          salvage_value: salvage,
          accumulated_depreciation: 0.00,
          current_book_value: cost
        });
      }

      // Record acquisition in asset ledger
      await trx('asset_ledger').insert({
        company_id: companyId,
        asset_id: assetId,
        event_type: 'ACQUISITION',
        event_date: data.purchase_date,
        description: `Initial Asset Card Registration: ${data.asset_name}`,
        amount: cost,
        voucher_id: data.purchase_voucher_id || null,
        created_by: userId
      });

      return assetId;
    });
  }

  // =========================================================================
  // AUTO-CAPITALIZATION TRIGGER PIPELINE
  // =========================================================================

  static async processVoucherCapitalization(voucherId, companyId, userId, trx) {
    const voucher = await trx('vouchers').where({ id: voucherId }).first();
    if (!voucher || voucher.type !== 'PURCHASE') return;

    const items = voucher.payload?.items || [];
    for (const item of items) {
      const product = await trx('products').where({ id: item.productId, company_id: companyId }).first();
      if (!product || !product.inventory_account_id) continue;

      // Check if product's asset account is mapped to any asset category
      const category = await trx('asset_categories')
        .where({ company_id: companyId, asset_account_id: product.inventory_account_id })
        .first();

      if (category) {
        const qty = parseInt(item.quantity || 1);
        const cost = parseFloat(item.unitCost || 0);

        for (let i = 1; i <= qty; i++) {
          const suffix = qty > 1 ? `-${i}` : '';
          const assetCode = `AST-${voucher.voucher_number}-${product.sku}${suffix}`;
          const assetName = `${product.name}${qty > 1 ? ` (Unit ${i})` : ''}`;

          // Check if already capitalized to prevent duplicate entries
          const exists = await trx('assets')
            .where({ company_id: companyId, asset_code: assetCode })
            .first();
          if (exists) continue;

          const insertResult = await trx('assets')
            .insert({
              company_id: companyId,
              asset_code: assetCode,
              asset_name: assetName,
              category_id: category.id,
              purchase_voucher_id: voucherId,
              purchase_date: voucher.date || new Date(),
              placed_in_service_date: voucher.date || new Date(),
              purchase_cost: cost,
              status: 'ACTIVE',
              notes: `Automatically capitalized from Purchase Voucher ${voucher.voucher_number}`
            })
            .returning('id');
          const assetId = extractId(insertResult);

          const books = ['Accounting', 'Tax', 'Management'];
          for (const bookName of books) {
            const salvage = (cost * parseFloat(category.default_salvage_percent)) / 100;
            await trx('asset_depreciation_books').insert({
              company_id: companyId,
              asset_id: assetId,
              book_name: bookName,
              depreciation_method: category.default_depreciation_method,
              useful_life_years: category.default_useful_life_years,
              useful_life_months: category.default_useful_life_years * 12,
              salvage_value: salvage,
              accumulated_depreciation: 0.00,
              current_book_value: cost
            });
          }

          await trx('asset_ledger').insert({
            company_id: companyId,
            asset_id: assetId,
            event_type: 'ACQUISITION',
            event_date: voucher.date || new Date(),
            description: `Automated Capitalization from Purchase Voucher ${voucher.voucher_number}`,
            amount: cost,
            voucher_id: voucherId,
            created_by: userId
          });
        }
      }
    }
  }

  // =========================================================================
  // DEPRECIATION ENGINE
  // =========================================================================

  static async calculateDepreciationRun(companyId, period, bookName = 'Accounting') {
    const runDate = new Date(`${period}-28`); // run date at end of month
    
    // Load all active assets
    const assets = await db('assets as a')
      .join('asset_categories as c', 'a.category_id', 'c.id')
      .where({ 'a.company_id': companyId, 'a.status': 'ACTIVE' })
      .andWhere('a.placed_in_service_date', '<=', runDate)
      .select('a.*', 'c.category_name');

    const calculations = [];

    for (const asset of assets) {
      const book = await db('asset_depreciation_books')
        .where({ asset_id: asset.id, book_name: bookName, company_id: companyId })
        .first();

      if (!book) continue;

      const openingValue = parseFloat(book.current_book_value);
      const salvageValue = parseFloat(book.salvage_value);
      
      if (openingValue <= salvageValue) continue; // Already depreciated to salvage limit

      let depAmount = 0;

      if (book.depreciation_method === 'STRAIGHT_LINE') {
        const cost = parseFloat(asset.purchase_cost);
        depAmount = (cost - salvageValue) / book.useful_life_months;
      } else if (book.depreciation_method === 'REDUCING_BALANCE') {
        const rate = 2.0 / book.useful_life_years; // Double Declining
        depAmount = (openingValue * rate) / 12;
      } else if (book.depreciation_method === 'UNITS_OF_PRODUCTION') {
        const estTotalUnits = parseFloat(asset.estimated_total_units || 0);
        if (estTotalUnits > 0) {
          // Fetch usage logs in this month's period
          const periodStart = `${period}-01`;
          const periodEnd = `${period}-31`;
          const usageResult = await db('asset_usage_logs')
            .where({ asset_id: asset.id, company_id: companyId })
            .andWhere('usage_date', '>=', periodStart)
            .andWhere('usage_date', '<=', periodEnd)
            .sum('units_used as total_used')
            .first();

          const unitsUsed = parseFloat(usageResult?.total_used || 0);
          const cost = parseFloat(asset.purchase_cost);
          const depRate = (cost - salvageValue) / estTotalUnits;
          depAmount = unitsUsed * depRate;
        }
      }

      // Max allowable depreciation to prevent book value falling below salvage limit
      const maxAllowed = openingValue - salvageValue;
      depAmount = Math.min(depAmount, maxAllowed);
      depAmount = Math.max(0, depAmount); // Ensure non-negative

      if (depAmount > 0) {
        calculations.push({
          asset_id: asset.id,
          asset_code: asset.asset_code,
          asset_name: asset.asset_name,
          category_name: asset.category_name,
          opening_book_value: openingValue,
          depreciation_amount: Math.round(depAmount * 100) / 100,
          closing_book_value: Math.round((openingValue - depAmount) * 100) / 100
        });
      }
    }

    return calculations;
  }

  static async postDepreciationRun(companyId, period, userId) {
    return await db.transaction(async trx => {
      const runDate = new Date(`${period}-28`);
      await PostingEngineService.assertPeriodOpen(companyId, runDate, trx);

      // 1. Confirm run doesn't exist or is in preview
      let run = await trx('depreciation_runs')
        .where({ company_id: companyId, period })
        .first();

      if (run && run.status === 'POSTED') {
        throw new Error(`Depreciation for period ${period} has already been posted.`);
      }

      // 2. Perform calculations (Always runs Accounting book for GL)
      const calculations = await this.calculateDepreciationRun(companyId, period, 'Accounting');
      if (calculations.length === 0) {
        if (!run) {
          const insertResult = await trx('depreciation_runs')
            .insert({
              company_id: companyId,
              run_date: runDate,
              period,
              method: 'AUTO',
              voucher_id: null,
              journal_entry_id: null,
              status: 'POSTED',
              created_by: userId
            })
            .returning('id');
          const insertedId = extractId(insertResult);
          run = { id: insertedId };
        } else {
          await trx('depreciation_runs')
            .where({ id: run.id })
            .update({
              voucher_id: null,
              journal_entry_id: null,
              status: 'POSTED',
              updated_at: trx.fn.now()
            });
        }
        return { id: run.id, total_depreciation: 0.00, message: 'Depreciation run completed with zero allocations.' };
      }

      // 3. Compile summarized double-entry lines grouped by Asset Category accounts
      const categoryGLSummary = {};

      for (const calc of calculations) {
        const asset = await trx('assets as a')
          .join('asset_categories as c', 'a.category_id', 'c.id')
          .where('a.id', calc.asset_id)
          .select(
            'c.accumulated_depreciation_account_id',
            'c.depreciation_expense_account_id'
          )
          .first();

        if (!asset || !asset.accumulated_depreciation_account_id || !asset.depreciation_expense_account_id) {
          throw new Error(`Asset '${calc.asset_code}' is missing Category GL mappings.`);
        }

        const expAcc = asset.depreciation_expense_account_id;
        const accAcc = asset.accumulated_depreciation_account_id;

        categoryGLSummary[expAcc] = (categoryGLSummary[expAcc] || 0) + calc.depreciation_amount;
        categoryGLSummary[accAcc] = (categoryGLSummary[accAcc] || 0) - calc.depreciation_amount; // credit
      }

      const totalDep = calculations.reduce((sum, c) => sum + c.depreciation_amount, 0);

      // Build balanced double-entry lines
      const journalLines = [];
      for (const [accountId, amt] of Object.entries(categoryGLSummary)) {
        if (amt > 0) {
          // Debit
          journalLines.push({ accountId: parseInt(accountId), debit: amt, credit: 0 });
        } else if (amt < 0) {
          // Credit
          journalLines.push({ accountId: parseInt(accountId), debit: 0, credit: -amt });
        }
      }

      // 4. Create sequence-numbered Journal Voucher record
      const dateStr = runDate.toISOString().split('T')[0];
      const voucherPayload = {
        date: dateStr,
        notes: `Depreciation Run for period ${period}`,
        lines: journalLines
      };

      // Query Sequence
      const seqRecord = await trx('voucher_sequences')
        .where({ company_id: companyId, type: 'JOURNAL' })
        .forUpdate()
        .first();

      let nextNum = 1;
      if (seqRecord) {
        nextNum = seqRecord.next_val;
        await trx('voucher_sequences')
          .where({ company_id: companyId, type: 'JOURNAL' })
          .update({ next_val: nextNum + 1 });
      } else {
        await trx('voucher_sequences').insert({
          company_id: companyId,
          type: 'JOURNAL',
          prefix: 'JV-',
          next_val: 2
        });
      }

      const prefix = seqRecord ? seqRecord.prefix : 'JV-';
      const voucherNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

      // Insert Voucher record
      const insertResult = await trx('vouchers')
        .insert({
          company_id: companyId,
          voucher_number: voucherNumber,
          type: 'JOURNAL',
          date: dateStr,
          status: 'DRAFT',
          total_amount: totalDep,
          tax_amount: 0,
          created_by: userId,
          payload: voucherPayload
        })
        .returning('id');
      const voucherId = extractId(insertResult);

      // 5. Post Voucher through standard PostingEngine
      const { journalEntryId } = await PostingEngineService.postTransaction({
        type: 'JOURNAL',
        companyId,
        payload: voucherPayload,
        userId,
        voucherId
      }, trx);

      // Update Voucher to POSTED
      await trx('vouchers')
        .where({ id: voucherId })
        .update({ status: 'POSTED', journal_entry_id: journalEntryId, updated_at: trx.fn.now() });

      // 6. Record run headers
      if (!run) {
        const insertResult = await trx('depreciation_runs')
          .insert({
            company_id: companyId,
            run_date: runDate,
            period,
            method: 'AUTO',
            voucher_id: voucherId,
            journal_entry_id: journalEntryId,
            status: 'POSTED',
            created_by: userId
          })
          .returning('id');
        const insertedId = extractId(insertResult);
        run = { id: insertedId };
      } else {
        await trx('depreciation_runs')
          .where({ id: run.id })
          .update({
            voucher_id: voucherId,
            journal_entry_id: journalEntryId,
            status: 'POSTED',
            updated_at: trx.fn.now()
          });
      }

      // 7. Write individual depreciation entry allocations and update asset sub-ledger book values
      for (const calc of calculations) {
        await trx('depreciation_entries').insert({
          depreciation_run_id: run.id,
          asset_id: calc.asset_id,
          opening_book_value: calc.opening_book_value,
          depreciation_amount: calc.depreciation_amount,
          closing_book_value: calc.closing_book_value
        });

        // Update Accounting book values
        const book = await trx('asset_depreciation_books')
          .where({ asset_id: calc.asset_id, book_name: 'Accounting', company_id: companyId })
          .first();

        const accum = parseFloat(book.accumulated_depreciation) + calc.depreciation_amount;

        await trx('asset_depreciation_books')
          .where({ id: book.id })
          .update({
            accumulated_depreciation: accum,
            current_book_value: calc.closing_book_value,
            last_depreciation_date: runDate,
            last_depreciation_run_id: run.id,
            updated_at: trx.fn.now()
          });

        // If units of production, update usage counters
        const assetObj = await trx('assets').where('id', calc.asset_id).first();
        if (assetObj.depreciation_method === 'UNITS_OF_PRODUCTION') {
          // Fetch usage logs in this month's period
          const periodStart = `${period}-01`;
          const periodEnd = `${period}-31`;
          const usageResult = await trx('asset_usage_logs')
            .where({ asset_id: calc.asset_id, company_id: companyId })
            .andWhere('usage_date', '>=', periodStart)
            .andWhere('usage_date', '<=', periodEnd)
            .sum('units_used as total_used')
            .first();

          const unitsUsed = parseFloat(usageResult?.total_used || 0);
          const currentTotalUsed = parseFloat(assetObj.current_units_used) + unitsUsed;
          const remaining = Math.max(0, parseFloat(assetObj.estimated_total_units) - currentTotalUsed);

          await trx('assets')
            .where({ id: calc.asset_id })
            .update({
              current_units_used: currentTotalUsed,
              remaining_units: remaining,
              updated_at: trx.fn.now()
            });
        }

        // Add sub-ledger entry
        await trx('asset_ledger').insert({
          company_id: companyId,
          asset_id: calc.asset_id,
          event_type: 'DEPRECIATION',
          event_date: runDate,
          description: `Monthly Depreciation Allocation for period ${period}`,
          book_name: 'Accounting',
          amount: calc.depreciation_amount,
          voucher_id: voucherId,
          journal_entry_id: journalEntryId,
          created_by: userId
        });
      }

      return { runId: run.id, voucherNumber, totalAmount: totalDep };
    });
  }

  // =========================================================================
  // DISPOSAL & LIFE-CYCLE MANAGEMENT
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

      // GL Postings construction:
      // Dr Cash / Bank Account (if sold): proceeds
      // Dr Accumulated Depreciation Account: accDep
      // Cr Asset Account: cost
      // Dr/Cr Gain/Loss on Disposal Account: difference
      const companySettings = await db('company_accounting_settings')
        .where({ company_id: companyId })
        .first();

      const cashAccount = companySettings?.default_cash_account_id;
      const disposalGainLossAccount = companySettings?.default_cogs_account_id; // Default fallback to COGS/Expense

      if (!category.asset_account_id || !category.accumulated_depreciation_account_id || !disposalGainLossAccount) {
        throw new Error('Asset, Accumulated Depreciation, or Gain/Loss Disposal accounts are missing.');
      }

      const journalLines = [
        // Credit original cost from Asset Account
        { accountId: category.asset_account_id, debit: 0, credit: cost }
      ];

      // Debit Accumulated Depreciation (to zero it)
      if (accDep > 0) {
        journalLines.push({ accountId: category.accumulated_depreciation_account_id, debit: accDep, credit: 0 });
      }

      // Debit Cash/Bank for proceeds
      if (proceeds > 0) {
        if (!cashAccount) throw new Error('Default Cash Account mapping is missing.');
        journalLines.push({ accountId: cashAccount, debit: proceeds, credit: 0 });
      }

      // Balance differences into Gain/Loss account
      if (gainLoss > 0) {
        // Gain (Credit Revenue/Disposal Gain)
        journalLines.push({ accountId: disposalGainLossAccount, debit: 0, credit: gainLoss });
      } else if (gainLoss < 0) {
        // Loss (Debit Expense/Disposal Loss)
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
        notes: `Retirement of Asset ${asset.asset_code}: ${data.disposal_reason}`,
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
        .update({ status: 'POSTED', journal_entry_id: journalEntryId, updated_at: trx.fn.now() });

      // Update Asset Status to Retired/Sold
      const newStatus = proceeds > 0 ? 'SOLD' : 'DISPOSED';
      await trx('assets')
        .where({ id: asset.id })
        .update({ status: newStatus, updated_at: trx.fn.now() });

      // Zero out all books current value
      await trx('asset_depreciation_books')
        .where({ asset_id: asset.id })
        .update({ current_book_value: 0.00, updated_at: trx.fn.now() });

      // Write sub-ledger retirement record
      await trx('asset_ledger').insert({
        company_id: companyId,
        asset_id: asset.id,
        event_type: proceeds > 0 ? 'SALE' : 'DISPOSAL',
        event_date: data.disposal_date,
        description: `Asset Retirement: ${data.disposal_reason}. Book Value was PKR ${bookValue.toLocaleString()}, Proceeds: PKR ${proceeds.toLocaleString()}`,
        amount: proceeds,
        voucher_id: voucherId,
        journal_entry_id: journalEntryId,
        created_by: userId
      });

      return { voucherNumber, gainLoss };
    });
  }

  // =========================================================================
  // METER USAGE LOGS CRUD
  // =========================================================================

  static async logUsage(companyId, userId, data) {
    return await db.transaction(async trx => {
      const asset = await trx('assets').where({ id: data.asset_id, company_id: companyId }).first();
      if (!asset) throw new Error('Asset not found.');

      await trx('asset_usage_logs').insert({
        company_id: companyId,
        asset_id: data.asset_id,
        usage_date: data.usage_date,
        units_used: parseFloat(data.units_used),
        source: data.source || 'MANUAL',
        created_by: userId
      });
    });
  }

  static async transferAsset(companyId, userId, data) {
    return await db.transaction(async trx => {
      const asset = await trx('assets').where({ id: data.asset_id, company_id: companyId }).first();
      if (!asset) throw new Error('Asset not found.');

      const updateData = {
        updated_at: trx.fn.now()
      };
      if (data.location_id !== undefined) updateData.location_id = data.location_id ? parseInt(data.location_id) : null;
      if (data.custodian_employee_id !== undefined) updateData.custodian_employee_id = data.custodian_employee_id ? parseInt(data.custodian_employee_id) : null;

      await trx('assets')
        .where({ id: data.asset_id })
        .update(updateData);

      let locName = 'Unassigned';
      if (data.location_id) {
        const wh = await trx('warehouses').where({ id: data.location_id }).first();
        if (wh) locName = wh.name;
      }
      let empName = 'Unassigned';
      if (data.custodian_employee_id) {
        const emp = await trx('employees').where({ id: data.custodian_employee_id }).first();
        if (emp) empName = emp.name;
      }

      await trx('asset_ledger').insert({
        company_id: companyId,
        asset_id: data.asset_id,
        event_type: 'TRANSFER',
        event_date: data.transfer_date || new Date().toISOString().split('T')[0],
        description: `Asset Custody Transfer: Location set to '${locName}', Custodian set to '${empName}'. Details: ${data.notes || ''}`,
        amount: 0.00,
        created_by: userId
      });

      return { success: true };
    });
  }

  static async logMaintenance(companyId, userId, data) {
    return await db.transaction(async trx => {
      const asset = await trx('assets').where({ id: data.asset_id, company_id: companyId }).first();
      if (!asset) throw new Error('Asset not found.');

      if (data.status) {
        await trx('assets')
          .where({ id: data.asset_id })
          .update({ status: data.status, updated_at: trx.fn.now() });
      }

      const cost = parseFloat(data.maintenance_cost || 0);

      await trx('asset_ledger').insert({
        company_id: companyId,
        asset_id: data.asset_id,
        event_type: 'MAINTENANCE',
        event_date: data.maintenance_date || new Date().toISOString().split('T')[0],
        description: `Maintenance Logged: ${data.description}. Cost: PKR ${cost.toLocaleString()}`,
        amount: cost,
        created_by: userId
      });

      return { success: true };
    });
  }
}

module.exports = FixedAssetsService;
