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
    res.json(balanceSheet);
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


