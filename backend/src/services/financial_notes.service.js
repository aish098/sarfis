const db = require('../config/db');

// Resolver Interface / Base
class NoteResolver {
  async resolve(companyId, account, targetDate) {
    throw new Error('Resolve method not implemented.');
  }
}

// 1. Asset Resolver: Handles Accumulated Depreciation / Amortization note breakdowns
// 1. Asset Note Resolver: Handles both Gross Asset Cost and Accumulated Depreciation note breakdowns
class AssetNoteResolver extends NoteResolver {
  async resolve(companyId, account, targetDate) {
    const nameLower = account.name.toLowerCase();
    
    // Check if the account represents an accumulated depreciation contra-account
    const isAccumulated = nameLower.includes('depreciation') || nameLower.includes('amortization');

    const breakdown = await db('assets as ast')
      .join('asset_categories as cat', 'ast.category_id', 'cat.id')
      .join('asset_depreciation_books as book', 'ast.id', 'book.asset_id')
      .where('book.book_name', 'Accounting')
      .andWhere('ast.company_id', companyId)
      .andWhere(builder => {
        if (isAccumulated) {
          builder.where('cat.accumulated_depreciation_account_id', account.id);
        } else {
          builder.where('cat.asset_account_id', account.id);
        }
      })
      .select(
        'ast.id as asset_id',
        'ast.asset_name as item',
        'ast.purchase_cost',
        'book.accumulated_depreciation'
      )
      .orderBy('ast.id', 'asc');

    const total = breakdown.reduce((sum, b) => {
      const val = isAccumulated ? parseFloat(b.accumulated_depreciation || 0) : parseFloat(b.purchase_cost || 0);
      return sum + val;
    }, 0) || 1;

    return breakdown.map(b => {
      const amount = isAccumulated ? parseFloat(b.accumulated_depreciation || 0) : parseFloat(b.purchase_cost || 0);
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

// 4. Inventory Resolver: Handles Inventory sub-ledger note breakdowns matching stock valuation
class InventoryResolver extends NoteResolver {
  async resolve(companyId, account, targetDate) {
    const stockItems = await db('v_stock_summary as v')
      .join('products as p', 'v.product_id', 'p.id')
      .where({ 'v.company_id': companyId, 'p.inventory_account_id': account.id })
      .andWhere('v.total_qty', '>', 0)
      .select('v.product_id', 'v.product_name as item', 'v.total_qty', 'v.cost_price');

    const totalValuation = stockItems.reduce((sum, item) => sum + (parseFloat(item.total_qty) * parseFloat(item.cost_price)), 0) || 1;

    return stockItems.map(item => {
      const amount = parseFloat(item.total_qty) * parseFloat(item.cost_price);
      return {
        id: `product-${item.product_id}`,
        item: item.item,
        amount,
        percent: Math.round((amount / totalValuation) * 100),
        drilldownType: 'product',
        drilldownId: item.product_id
      };
    });
  }
}

// Main note coordination service
class FinancialNotesService {
  static getResolver(account) {
    const nameLower = account.name.toLowerCase();
    const group = this.getReportGroup(account);
    
    if (group === 'PPE' || nameLower.includes('depreciation') || nameLower.includes('amortization')) {
      return new AssetNoteResolver();
    }
    if (nameLower.includes('bad debt') || nameLower.includes('allowance') || nameLower.includes('doubtful')) {
      return new BadDebtResolver();
    }
    if (nameLower.includes('inventory')) {
      return new InventoryResolver();
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
    const targetDate = asOfDate ? new Date(asOfDate) : new Date();
    const startOfYear = new Date(targetDate.getFullYear(), 0, 1);

    // Special Handler for Synthetic Balance Sheet Items: Current Year Earnings (ytd)
    if (String(accountId).toLowerCase() === 'ytd' || String(accountId).toLowerCase().includes('earnings')) {
      const revLines = await db('journal_lines as jl')
        .join('journal_entries as je', 'jl.entry_id', 'je.id')
        .join('accounts as acc', 'jl.account_id', 'acc.id')
        .where('acc.company_id', companyId)
        .andWhereRaw("LOWER(acc.category) IN ('income', 'revenue') OR LOWER(acc.type) IN ('income', 'revenue')")
        .andWhere('je.entry_date', '>=', startOfYear)
        .andWhere('je.entry_date', '<=', targetDate)
        .select('acc.id', 'acc.name', 'acc.code', db.raw('SUM(jl.credit - jl.debit) as net_amount'))
        .groupBy('acc.id', 'acc.name', 'acc.code');

      const expLines = await db('journal_lines as jl')
        .join('journal_entries as je', 'jl.entry_id', 'je.id')
        .join('accounts as acc', 'jl.account_id', 'acc.id')
        .where('acc.company_id', companyId)
        .andWhereRaw("LOWER(acc.category) = 'expense' OR LOWER(acc.type) = 'expense'")
        .andWhere('je.entry_date', '>=', startOfYear)
        .andWhere('je.entry_date', '<=', targetDate)
        .select('acc.id', 'acc.name', 'acc.code', db.raw('SUM(jl.debit - jl.credit) as net_amount'))
        .groupBy('acc.id', 'acc.name', 'acc.code');

      const totalRev = revLines.reduce((s, r) => s + parseFloat(r.net_amount || 0), 0);
      const totalExp = expLines.reduce((s, r) => s + parseFloat(r.net_amount || 0), 0);
      const netIncome = totalRev - totalExp;

      const breakdown = [
        {
          id: 'note-rev-total',
          item: 'Total Operating & Non-Operating Revenue',
          amount: totalRev,
          percent: totalRev > 0 ? 100 : 0,
          drilldownType: 'report',
          drilldownId: 'income_statement'
        },
        {
          id: 'note-exp-total',
          item: 'Total Operating & Administrative Expenses',
          amount: -totalExp,
          percent: totalRev > 0 ? Math.round((totalExp / (totalRev || 1)) * 100) : 0,
          drilldownType: 'report',
          drilldownId: 'income_statement'
        }
      ];

      const journalEntries = await db('journal_lines as jl')
        .join('journal_entries as je', 'jl.entry_id', 'je.id')
        .join('accounts as acc', 'jl.account_id', 'acc.id')
        .leftJoin('vouchers as v', 'je.id', 'v.journal_entry_id')
        .where('acc.company_id', companyId)
        .andWhereRaw("LOWER(acc.category) IN ('income', 'revenue', 'expense') OR LOWER(acc.type) IN ('income', 'revenue', 'expense')")
        .andWhere('je.entry_date', '>=', startOfYear)
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

      return {
        account: {
          id: 'ytd',
          code: '3900-YTD',
          name: 'Current Year Earnings (Net Income)',
          category: 'Equity',
          normal_balance: 'Credit',
          is_contra: false,
          is_control: false
        },
        openingBalance: 0,
        movements: netIncome,
        closingBalance: netIncome,
        breakdown,
        journalEntries: journalEntries.map(je => ({
          ...je,
          debit: parseFloat(je.debit || 0),
          credit: parseFloat(je.credit || 0)
        })),
        reconciliation: {
          status: 'VERIFIED',
          difference: 0,
          reasons: ['Calculated directly from real-time Revenue & Expense General Ledger postings.']
        },
        metadata: {
          noteNumber: 'Note 15',
          noteName: 'Current Year Earnings (Net Income)',
          source: 'General Ledger Income & Expense Accounts',
          lastUpdated: targetDate
        }
      };
    }

    // Regular GL Account Lookup
    let account = await db('accounts')
      .where({ id: parseInt(accountId) || 0, company_id: companyId })
      .first();

    if (!account && typeof accountId === 'string') {
      account = await db('accounts')
        .where({ company_id: companyId })
        .andWhere(builder => {
          builder.where({ code: accountId }).orWhere({ name: accountId });
        })
        .first();
    }

    if (!account) {
      throw new Error(`GL Account (#${accountId}) not found.`);
    }

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
