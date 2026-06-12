const db = require('../config/db');

class JournalModel {
  static async createEntry(entryData, trx) {
    const query = db('journal_entries');
    if (trx) query.transacting(trx);

    const [entry] = await query
      .insert({
        company_id: entryData.companyId,
        entry_date: entryData.entryDate || new Date(),
        description: entryData.description,
        status: entryData.status || 'DRAFT',
        created_by: entryData.userId
      })
      .returning('id');
    return entry.id;
  }

  static async createLine(lineData, trx) {
    const query = db('journal_lines');
    if (trx) query.transacting(trx);

    await query.insert({
      entry_id: lineData.entryId,
      account_id: lineData.accountId,
      debit: lineData.debit || 0,
      credit: lineData.credit || 0
    });
  }

  static async getEntriesByCompany(companyId) {
    return db('journal_entries as je')
      .leftJoin('users as u', 'je.created_by', 'u.id')
      .leftJoin('journal_lines as jl', 'je.id', 'jl.entry_id')
      .select(
        'je.*', 
        db.raw("COALESCE(u.name, 'System') as created_name"),
        db.raw('COALESCE(SUM(jl.debit), 0) as total_amount')
      )
      .where('je.company_id', companyId)
      .groupBy('je.id', 'u.id', 'u.name')
      .orderBy('je.entry_date', 'desc');
  }

  static async getEntryHeader(id, companyId) {
    return db('journal_entries')
      .where({ id, company_id: companyId })
      .first();
  }

  static async getEntryLines(entryId) {
    return db('journal_lines as jl')
      .join('accounts as a', 'jl.account_id', 'a.id')
      .select('jl.*', 'a.name as account_name', 'a.code')
      .where('jl.entry_id', entryId);
  }

  static async getLedgerByAccount(accountId, companyId) {
    return db('journal_lines as jl')
      .join('journal_entries as je', 'jl.entry_id', 'je.id')
      .join('accounts as a', 'jl.account_id', 'a.id')
      .select('jl.id', 'jl.entry_id', 'je.entry_date', 'je.description', 'jl.debit', 'jl.credit')
      .where('jl.account_id', accountId)
      .andWhere('je.company_id', companyId)
      .andWhere('a.company_id', companyId)
      .orderBy('je.entry_date', 'asc')
      .orderBy('je.id', 'asc');
  }
  static async deleteEntry(entryId, companyId) {
    return db.transaction(async trx => {
      const entry = await trx('journal_entries').where({ id: entryId, company_id: companyId }).first();
      if (!entry) throw new Error('Entry not found or unauthorized');

      const lines = await trx('journal_lines').where('entry_id', entryId);

      for (let line of lines) {
        await trx('accounts')
          .where({ id: line.account_id, company_id: companyId })
          .decrement('balance', parseFloat(line.debit || 0) - parseFloat(line.credit || 0));
      }

      await trx('journal_lines').where('entry_id', entryId).delete();
      await trx('journal_entries').where('id', entryId).delete();
      return true;
    });
  }

  static async postEntry(entryId, companyId) {
    return db('journal_entries')
      .where({ id: entryId, company_id: companyId })
      .update({ status: 'POSTED' });
  }
}

module.exports = JournalModel;