const db = require('../config/db');
const JournalService = require('../services/journal.service');

/**
 * Fetches all fiscal years for a company.
 * Automatically seeds them from accounting_periods if none exist.
 */
exports.getFiscalYears = async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: 'Company context required.' });

  try {
    let rows = await db('fiscal_years')
      .where({ company_id: companyId })
      .orderBy('year_name', 'desc');

    if (rows.length === 0) {
      // Auto-seed from accounting_periods
      const periods = await db('accounting_periods').where({ company_id: companyId });
      if (periods.length > 0) {
        const years = [...new Set(periods.map(p => {
          if (!p.start_date) return null;
          const d = new Date(p.start_date);
          return isNaN(d.getTime()) ? null : d.getFullYear().toString();
        }))].filter(Boolean);

        for (const y of years) {
          const yearPeriods = periods.filter(p => {
            const d = new Date(p.start_date);
            return !isNaN(d.getTime()) && d.getFullYear().toString() === y;
          });
          if (yearPeriods.length === 0) continue;

          const startDate = yearPeriods.reduce((min, p) => p.start_date < min ? p.start_date : min, yearPeriods[0].start_date);
          const endDate = yearPeriods.reduce((max, p) => p.end_date > max ? p.end_date : max, yearPeriods[0].end_date);
          
          try {
            await db('fiscal_years').insert({
              company_id: companyId,
              year_name: y,
              start_date: startDate,
              end_date: endDate,
              status: 'OPEN'
            });
          } catch (e) {}
        }

        rows = await db('fiscal_years')
          .where({ company_id: companyId })
          .orderBy('year_name', 'desc');
      }
    }

    res.json(rows);
  } catch (err) {
    console.error('[GET FISCAL YEARS ERROR]', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Retrieves the opening balance migration entry for a specific fiscal year
 */
exports.getOpeningBalances = async (req, res) => {
  const companyId = req.companyId;
  const { fiscal_year_id } = req.query;

  if (!companyId) return res.status(400).json({ error: 'Company context required.' });
  if (!fiscal_year_id) return res.status(400).json({ error: 'Fiscal year ID is required.' });

  try {
    const entry = await db('journal_entries')
      .where({ company_id: companyId, type: 'OPENING_BALANCE', fiscal_year_id: parseInt(fiscal_year_id, 10) })
      .first();

    if (!entry) {
      return res.json({ status: 'NOT_STARTED', lines: [] });
    }

    const lines = await db('journal_lines as jl')
      .join('accounts as a', 'jl.account_id', 'a.id')
      .select('jl.*', 'a.name as account_name', 'a.code', 'a.category', 'a.normal_balance')
      .where('jl.entry_id', entry.id);

    res.json({
      id: entry.id,
      entry_date: entry.entry_date,
      description: entry.description,
      status: entry.status,
      created_by: entry.created_by,
      created_at: entry.created_at,
      lines: lines.map(l => ({
        accountId: l.account_id,
        account_code: l.code,
        account_name: l.account_name,
        category: l.category,
        normal_balance: l.normal_balance,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0
      }))
    });
  } catch (err) {
    console.error('[GET OPENING BALANCES ERROR]', err);
    res.status(550).json({ error: err.message });
  }
};

/**
 * Saves/updates a draft opening balance entry
 */
exports.saveOpeningBalancesDraft = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.user.id;
  const { fiscal_year_id, entry_date, description, lines, import_file_name, rows_imported, rows_matched, rows_ignored } = req.body;

  if (!companyId) return res.status(400).json({ error: 'Company context required.' });
  if (!fiscal_year_id) return res.status(400).json({ error: 'Fiscal year ID is required.' });
  if (!lines || !Array.isArray(lines)) return res.status(400).json({ error: 'Opening balance lines must be provided.' });

  try {
    await db.transaction(async (trx) => {
      // 1. Verify target fiscal year exists and is open
      const fy = await trx('fiscal_years').where({ id: fiscal_year_id, company_id: companyId }).first();
      if (!fy) throw new Error('Target fiscal year not found.');
      if (fy.status !== 'OPEN') throw new Error('Opening balances cannot be updated for a closed fiscal year.');

      // 2. Verify no posted opening balances already exist
      const posted = await trx('journal_entries')
        .where({ company_id: companyId, type: 'OPENING_BALANCE', fiscal_year_id: fy.id, status: 'POSTED' })
        .first();

      if (posted) {
        throw new Error(`Opening balances for fiscal year ${fy.year_name} have already been posted and locked.`);
      }

      // 3. Find existing draft
      const draft = await trx('journal_entries')
        .where({ company_id: companyId, type: 'OPENING_BALANCE', fiscal_year_id: fy.id, status: 'DRAFT' })
        .first();

      let entryId;
      const desc = description || `Opening balances migration for FY ${fy.year_name}`;
      // Opening balances are typically dated on the first day of the fiscal year
      const date = entry_date || fy.start_date;

      if (draft) {
        entryId = draft.id;
        await trx('journal_entries')
          .where({ id: entryId })
          .update({
            entry_date: date,
            description: desc,
            updated_at: trx.fn.now()
          });

        // Clear existing draft lines
        await trx('journal_lines').where({ entry_id: entryId }).delete();
      } else {
        const [newEntry] = await trx('journal_entries')
          .insert({
            company_id: companyId,
            entry_date: date,
            description: desc,
            reference: `OB-${fy.year_name}`,
            status: 'DRAFT',
            type: 'OPENING_BALANCE',
            source: 'MIGRATION',
            fiscal_year_id: fy.id,
            created_by: userId
          })
          .returning('id');
        
        entryId = typeof newEntry === 'object' ? newEntry.id : newEntry;
      }

      // 4. Insert lines (only non-zero balances)
      const linesToInsert = lines
        .filter(l => (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map(l => ({
          entry_id: entryId,
          account_id: parseInt(l.accountId, 10),
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0
        }));

      if (linesToInsert.length > 0) {
        await trx('journal_lines').insert(linesToInsert);
      }

      // 5. Audit metadata logging in settings or audit logs
      if (import_file_name) {
        const metadata = {
          import_file_name,
          rows_imported: parseInt(rows_imported || 0, 10),
          rows_matched: parseInt(rows_matched || 0, 10),
          rows_ignored: parseInt(rows_ignored || 0, 10),
          saved_by: userId,
          saved_at: new Date()
        };

        // Store migration metadata in company settings
        const existingSettings = await trx('settings')
          .where({ scope: 'company', target_id: String(companyId) })
          .first();

        const obMetaKey = `ob_migration_meta_${fy.id}`;
        if (existingSettings) {
          const mergedValue = { ...existingSettings.value, [obMetaKey]: metadata };
          await trx('settings')
            .where({ id: existingSettings.id })
            .update({ value: mergedValue, updated_at: trx.fn.now() });
        } else {
          await trx('settings')
            .insert({
              scope: 'company',
              target_id: String(companyId),
              value: { [obMetaKey]: metadata }
            });
        }
      }
    });

    res.json({ message: 'Opening balances draft saved successfully.' });
  } catch (err) {
    console.error('[SAVE OPENING BALANCES ERROR]', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Validates and posts the opening balances to the ledger
 */
exports.postOpeningBalances = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.user.id;
  const { fiscal_year_id } = req.body;

  if (!companyId) return res.status(400).json({ error: 'Company context required.' });
  if (!fiscal_year_id) return res.status(400).json({ error: 'Fiscal year ID is required.' });

  try {
    const entry = await db('journal_entries')
      .where({ company_id: companyId, type: 'OPENING_BALANCE', fiscal_year_id: parseInt(fiscal_year_id, 10), status: 'DRAFT' })
      .first();

    if (!entry) {
      return res.status(404).json({ error: `No draft opening balances found for this fiscal year.` });
    }

    const lines = await db('journal_lines').where({ entry_id: entry.id });
    if (lines.length === 0) {
      return res.status(400).json({ error: 'Cannot post empty opening balances. Please enter at least one balance.' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseFloat(line.debit) || 0;
      totalCredit += parseFloat(line.credit) || 0;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      return res.status(400).json({
        error: `Out of Balance: Total debits (PKR ${totalDebit.toLocaleString()}) must equal total credits (PKR ${totalCredit.toLocaleString()}). Difference is PKR ${diff.toLocaleString()}.`,
        details: {
          debits: totalDebit,
          credits: totalCredit,
          difference: diff
        }
      });
    }

    // Post the journal entry using JournalService (passing overrideControlWarning = true)
    await JournalService.postJournalEntry(entry.id, companyId, userId, true);

    // Save posted log details
    const existingSettings = await db('settings')
      .where({ scope: 'company', target_id: String(companyId) })
      .first();

    const obMetaKey = `ob_migration_meta_${fiscal_year_id}`;
    const postedMeta = {
      posted_by: userId,
      posted_name: req.user.name || 'Admin',
      posted_at: new Date()
    };

    if (existingSettings) {
      const currentMeta = existingSettings.value[obMetaKey] || {};
      const mergedValue = { ...existingSettings.value, [obMetaKey]: { ...currentMeta, ...postedMeta } };
      await db('settings')
        .where({ id: existingSettings.id })
        .update({ value: mergedValue, updated_at: db.fn.now() });
    } else {
      await db('settings')
        .insert({
          scope: 'company',
          target_id: String(companyId),
          value: { [obMetaKey]: postedMeta }
        });
    }

    res.json({ message: 'Opening balances posted to ledger successfully.' });
  } catch (err) {
    console.error('[POST OPENING BALANCES ERROR]', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Clears the draft opening balances configuration for a fiscal year
 */
exports.clearOpeningBalancesDraft = async (req, res) => {
  const companyId = req.companyId;
  const { fiscal_year_id } = req.body;

  if (!companyId) return res.status(400).json({ error: 'Company context required.' });
  if (!fiscal_year_id) return res.status(400).json({ error: 'Fiscal year ID is required.' });

  try {
    await db.transaction(async (trx) => {
      // 1. Verify not posted
      const posted = await trx('journal_entries')
        .where({ company_id: companyId, type: 'OPENING_BALANCE', fiscal_year_id: parseInt(fiscal_year_id, 10), status: 'POSTED' })
        .first();

      if (posted) {
        throw new Error('Cannot clear opening balances because they have already been posted and locked.');
      }

      // 2. Find and delete draft
      const draft = await trx('journal_entries')
        .where({ company_id: companyId, type: 'OPENING_BALANCE', fiscal_year_id: parseInt(fiscal_year_id, 10), status: 'DRAFT' })
        .first();

      if (draft) {
        // Delete lines
        await trx('journal_lines').where({ entry_id: draft.id }).delete();
        // Delete entry
        await trx('journal_entries').where({ id: draft.id }).delete();
      }

      // 3. Clear settings metadata
      const existingSettings = await trx('settings')
        .where({ scope: 'company', target_id: String(companyId) })
        .first();

      const obMetaKey = `ob_migration_meta_${fiscal_year_id}`;
      if (existingSettings && existingSettings.value[obMetaKey]) {
        const valueCopy = { ...existingSettings.value };
        delete valueCopy[obMetaKey];
        await trx('settings')
          .where({ id: existingSettings.id })
          .update({ value: valueCopy, updated_at: trx.fn.now() });
      }
    });

    res.json({ message: 'Opening balances draft cleared successfully.' });
  } catch (err) {
    console.error('[CLEAR OPENING BALANCES ERROR]', err);
    res.status(400).json({ error: err.message });
  }
};
