const ReportService = require('../services/report.service');
const ReportModel = require('../models/report.model');
const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');

exports.getTrialBalance = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate } = req.query;
  try {
    const trialBalance = await ReportModel.getTrialBalance(companyId, startDate, endDate);
    res.json(trialBalance);
  } catch (err) {
    console.error('getTrialBalance error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAdjustedTrialBalance = exports.getTrialBalance;

exports.getIncomeStatement = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate } = req.query;
  
  try {
    const incomeStatement = await ReportModel.getIncomeStatement(companyId, startDate, endDate);
    res.json(incomeStatement);
  } catch (err) {
    console.error('getIncomeStatement error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getBalanceSheet = async (req, res) => {
  const { companyId } = req.params;
  const { asOfDate } = req.query;
  
  try {
    const balanceSheet = await ReportModel.getBalanceSheet(companyId, asOfDate);

    const db = require('../config/db');
    const templates = await db('financial_statement_note_templates')
      .where({ company_id: companyId, statement_type: 'BALANCE_SHEET' });
    
    const templateMap = {};
    for (const t of templates) {
      templateMap[t.report_group] = t;
    }

    const getReportGroup = (code, name) => {
      const c = String(code || '');
      const n = String(name || '').toLowerCase();
      if (c.startsWith('10')) return 'CASH';
      if (c.startsWith('12') && !n.includes('allowance') && !n.includes('bad debt') && !n.includes('doubtful')) return 'RECEIVABLES';
      if (n.includes('allowance') || n.includes('bad debt') || n.includes('doubtful')) return 'BAD_DEBT';
      if (c.startsWith('13')) return 'INVENTORY';
      if (c.startsWith('15') || c.startsWith('16')) return 'PPE';
      if (c.startsWith('20') || c.startsWith('21')) return 'PAYABLES';
      if (n.includes('tax') || c.startsWith('22')) return 'TAX';
      return null;
    };

    const FinancialNotesService = require('../services/financial_notes.service');
    const enrichedBalanceSheet = await Promise.all(balanceSheet.map(async (acc) => {
      const reportGroup = getReportGroup(acc.code, acc.name);
      const template = reportGroup ? templateMap[reportGroup] : null;
      if (template) {
        try {
          const noteInfo = await FinancialNotesService.getAccountNote(companyId, acc.id, asOfDate);
          return {
            ...acc,
            noteMeta: {
              num: template.note_number,
              label: template.note_name,
              source: noteInfo.metadata.source,
              generated: noteInfo.metadata.generated,
              lastUpdated: noteInfo.metadata.lastUpdated,
              supportingRecordsCount: noteInfo.metadata.supportingRecordsCount,
              reconciliationStatus: noteInfo.reconciliation.status
            }
          };
        } catch (e) {
          console.error(`Failed to enrich note metadata for account ${acc.id}:`, e);
        }
      }
      return acc;
    }));

    res.json(enrichedBalanceSheet);
  } catch (err) {
    console.error('getBalanceSheet error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCashFlow = async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate } = req.query;
  try {
    const cashFlow = await ReportModel.getCashFlow(companyId, startDate, endDate);
    res.json(cashFlow);
  } catch(err) {
     res.status(500).json({ error: err.message });
  }
};

exports.closePeriod = async (req, res) => {
  const { companyId } = req.params;
  const { endDate, description } = req.body;
  
  try {
    const result = await ReportService.closePeriod(companyId, endDate, description);
    res.json(result);
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('No temporary accounts') || err.message.includes('already at $0.00')) {
        return res.status(400).json({ message: err.message });
    }
    console.error('closePeriod error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLedgerByAccount = async (req, res) => {
  const { accountId } = req.params;
  const companyId = req.companyId;

  try {
    const result = await JournalModel.getLedgerByAccount(accountId, companyId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const FinancialNotesService = require('../services/financial_notes.service');

exports.getBalanceSheetNote = async (req, res) => {
  const { accountId } = req.params;
  const { asOfDate } = req.query;
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ error: 'Company context is required.' });
  }

  try {
    const note = await FinancialNotesService.getAccountNote(companyId, accountId, asOfDate);
    res.json(note);
  } catch (err) {
    console.error('getBalanceSheetNote error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAPAging = async (req, res) => {
  const { companyId } = req.params;
  try {
    const result = await ReportService.getAPAging(companyId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getARAging = async (req, res) => {
  const { companyId } = req.params;
  try {
    const result = await ReportService.getARAging(companyId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVendorStatement = async (req, res) => {
  const { companyId, vendorId } = req.params;
  try {
    const result = await ReportService.getVendorStatement(companyId, vendorId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerStatement = async (req, res) => {
  const { companyId, clientId } = req.params;
  try {
    const result = await ReportService.getCustomerStatement(companyId, clientId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


