const db = require('../config/db');

// Resolver Interface / Base
class NoteResolver {
  async resolve(companyId, account, targetDate) {
    throw new Error('Resolve method not implemented.');
  }
}

// 1. Asset Resolver: Handles Accumulated Depreciation / Amortization note breakdowns
class AssetResolver extends NoteResolver {
  async resolve(companyId, account, targetDate) {
    let breakdown = await db('assets as ast')
      .join('asset_depreciation_books as book', 'ast.id', 'book.asset_id')
      .where('book.book_name', 'Accounting')
      .andWhere('ast.company_id', companyId)
      .select('ast.id as asset_id', 'ast.asset_name as item', 'book.accumulated_depreciation as amount')
      .orderBy('amount', 'desc');

    const total = breakdown.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0) || 1;
    return breakdown.map(b => {
      const amount = parseFloat(b.amount || 0);
      return {
        id: `asset-${b.asset_id}`,
        item: b.item,
        amount,
        percent: Math.round((amount / total) * 100),
        drilldownType: 'asset',
        drilldownId: b.asset_id
      };
    });
  }
}

// 2. Bad Debt Resolver: Handles Allowances for Bad Debts / Customer Provisions notes
class BadDebtResolver extends NoteResolver {
  async resolve(companyId, account, targetDate) {
    const incidentBreakdown = await db('business_risk_incidents as bri')
      .join('clients as c', 'bri.entity_id', 'c.id')
      .where('bri.entity_type', 'CUSTOMER')
      .andWhere('bri.company_id', companyId)
      .select('c.id as client_id', 'c.name as item', db.raw('SUM(bri.loss_amount - bri.recovered_amount) as amount'))
      .groupBy('c.id', 'c.name')
      .orderBy('amount', 'desc');

    const total = incidentBreakdown.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0) || 1;
    return incidentBreakdown
      .map(b => {
        const amount = parseFloat(b.amount || 0);
        return {
          id: `client-${b.client_id}`,
          item: b.item,
          amount,
          percent: Math.round((amount / total) * 100),
          drilldownType: 'client',
          drilldownId: b.client_id
        };
      })
      .filter(b => b.amount > 0);
  }
}

// 3. Default Resolver: Groups journal entries by transaction description for generic accounts
class DefaultResolver extends NoteResolver {
  async resolve(companyId, account, targetDate) {
    const normal = account.normal_balance?.toLowerCase() || 'debit';
    
    const entryBreakdown = await db('journal_lines as jl')
      .join('journal_entries as je', 'jl.entry_id', 'je.id')
      .where('jl.account_id', account.id)
      .andWhere('je.entry_date', '<=', targetDate)
      .select('je.description as item', db.raw('SUM(jl.debit - jl.credit) as net_amount'))
      .groupBy('je.description')
      .orderBy(db.raw('ABS(SUM(jl.debit - jl.credit))'), 'desc')
      .limit(10);

    const totalRaw = entryBreakdown.reduce((sum, eb) => {
      const net = parseFloat(eb.net_amount || 0);
      const val = normal === 'credit' ? -net : net;
      return sum + Math.max(0, val);
    }, 0) || 1;

    return entryBreakdown
      .map((eb, idx) => {
        const net = parseFloat(eb.net_amount || 0);
        const amount = normal === 'credit' ? -net : net;
        return {
          id: `entry-grp-${idx}`,
          item: eb.item || 'Journal Entry Reference',
          amount,
          percent: Math.round((Math.max(0, amount) / totalRaw) * 100),
          drilldownType: 'entry',
          drilldownId: null
        };
      })
      .filter(eb => Math.abs(eb.amount) > 0.01);
  }
}

// Main note coordination service
class FinancialNotesService {
  static getResolver(account) {
    const nameLower = account.name.toLowerCase();
    
    if (nameLower.includes('depreciation') || nameLower.includes('amortization')) {
      return new AssetResolver();
    }
    if (nameLower.includes('bad debt') || nameLower.includes('allowance') || nameLower.includes('doubtful')) {
      return new BadDebtResolver();
    }
    
    return new DefaultResolver();
  }

  static getReportGroup(account) {
    const c = String(account.code || '');
    const n = String(account.name || '').toLowerCase();
    if (c.startsWith('10')) return 'CASH';
    if (c.startsWith('12') && !n.includes('allowance') && !n.includes('bad debt') && !n.includes('doubtful')) return 'RECEIVABLES';
    if (n.includes('allowance') || n.includes('bad debt') || n.includes('doubtful')) return 'BAD_DEBT';
    if (c.startsWith('13')) return 'INVENTORY';
    if (c.startsWith('15') || c.startsWith('16')) return 'PPE';
    if (c.startsWith('20') || c.startsWith('21')) return 'PAYABLES';
    if (n.includes('tax') || c.startsWith('22')) return 'TAX';
    return 'DEFAULT';
  }

  static async getAccountNote(companyId, accountId, asOfDate) {
    const account = await db('accounts')
      .where({ id: accountId, company_id: companyId })
      .first();

    if (!account) {
      throw new Error('GL Account not found.');
    }

    const targetDate = asOfDate ? new Date(asOfDate) : new Date();
    const startOfYear = new Date(targetDate.getFullYear(), 0, 1);

    // 1. Calculate opening balance (prior to the current year)
    const openingRes = await db('journal_lines as jl')
      .join('journal_entries as je', 'jl.entry_id', 'je.id')
      .where('jl.account_id', accountId)
      .andWhere('je.entry_date', '<', startOfYear)
      .select(db.raw('SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit'))
      .first();
    
    const opDebit = parseFloat(openingRes?.total_debit || 0);
    const opCredit = parseFloat(openingRes?.total_credit || 0);
    
    // 2. Calculate movements (during current year)
    const movementRes = await db('journal_lines as jl')
      .join('journal_entries as je', 'jl.entry_id', 'je.id')
      .where('jl.account_id', accountId)
      .andWhere('je.entry_date', '>=', startOfYear)
      .andWhere('je.entry_date', '<=', targetDate)
      .select(db.raw('SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit'))
      .first();

    const mvDebit = parseFloat(movementRes?.total_debit || 0);
    const mvCredit = parseFloat(movementRes?.total_credit || 0);

    const normal = account.normal_balance?.toLowerCase() || 'debit';
    const computeBalance = (debit, credit) => (normal === 'credit' ? credit - debit : debit - credit);

    const openingBalance = computeBalance(opDebit, opCredit);
    const movements = computeBalance(mvDebit, mvCredit);
    const closingBalance = openingBalance + movements;

    // 3. Resolve breakdown schedule
    const resolver = this.getResolver(account);
    const breakdown = await resolver.resolve(companyId, account, targetDate);

    // 4. Retrieve recent Journal Entry postings (paginated/limited)
    const journalEntries = await db('journal_lines as jl')
      .join('journal_entries as je', 'jl.entry_id', 'je.id')
      .leftJoin('vouchers as v', 'je.id', 'v.journal_entry_id')
      .where('jl.account_id', accountId)
      .andWhere('je.entry_date', '<=', targetDate)
      .select(
        'je.id as journal_entry_id',
        'je.entry_date as date',
        'je.description',
        'jl.debit',
        'jl.credit',
        'v.id as voucher_id',
        'v.voucher_number',
        'v.type as voucher_type'
      )
      .orderBy('je.entry_date', 'desc')
      .limit(10);

    const ReconciliationService = require('./reconciliation.service');
    const reconciliation = await ReconciliationService.reconcileAccount(companyId, account, closingBalance, breakdown);

    const reportGroup = this.getReportGroup(account);
    const template = await db('financial_statement_note_templates')
      .where({ company_id: companyId, statement_type: 'BALANCE_SHEET', report_group: reportGroup })
      .first();

    const noteNumber = template ? template.note_number : null;
    const noteName = template ? template.note_name : account.name;

    const nameLower = account.name.toLowerCase();
    let source = 'General Ledger';
    if (nameLower.includes('depreciation') || nameLower.includes('amortization')) {
      source = 'Asset Register';
    } else if (nameLower.includes('bad debt') || nameLower.includes('allowance') || nameLower.includes('doubtful')) {
      source = 'Risk Register';
    }

    const lastUpdated = journalEntries[0]?.date || targetDate;

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        category: account.category,
        normal_balance: account.normal_balance,
        is_contra: account.is_contra,
        is_control: account.is_control
      },
      openingBalance,
      movements,
      closingBalance,
      breakdown,
      journalEntries: journalEntries.map(je => ({
        ...je,
        debit: parseFloat(je.debit || 0),
        credit: parseFloat(je.credit || 0)
      })),
      metadata: {
        source,
        generated: 'Automatically',
        lastUpdated,
        supportingRecordsCount: breakdown.length,
        noteNumber,
        noteName
      },
      reconciliation
    };
  }
}

module.exports = FinancialNotesService;
