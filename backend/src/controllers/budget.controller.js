const db = require('../config/db');
const BudgetService = require('../services/budget.service');

// List budgets
exports.getBudgets = async (req, res) => {
  const companyId = req.companyId;
  try {
    const budgets = await db('budget_headers')
      .where({ company_id: companyId })
      .orderBy('fiscal_year', 'desc')
      .orderBy('version_name', 'asc');
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single budget detail lines with actual and committed spend
exports.getBudgetDetails = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  try {
    const header = await db('budget_headers').where({ id, company_id: companyId }).first();
    if (!header) return res.status(404).json({ error: 'Budget not found.' });

    const lines = await db('budget_control_lines').where({ budget_header_id: id }).orderBy('id', 'asc');

    const resultLines = [];
    for (const line of lines) {
      const actualRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
        .sum('amount as total');
      const actual = parseFloat(actualRes[0]?.total || 0);

      const committedRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
        .sum('amount as total');
      const committed = parseFloat(committedRes[0]?.total || 0);

      const account = await db('accounts').where({ id: line.account_id }).first();

      resultLines.push({
        ...line,
        account_code: account?.code || '',
        account_name: account?.name || '',
        actual_amount: actual,
        committed_amount: committed,
        remaining_amount: parseFloat(line.allocated_amount) - (actual + committed)
      });
    }

    res.json({ header, lines: resultLines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create or update budget header
exports.saveBudgetHeader = async (req, res) => {
  const companyId = req.companyId;
  const { id, fiscalYear, name, versionName, status } = req.body;

  try {
    let result;
    if (id) {
      [result] = await db('budget_headers')
        .where({ id, company_id: companyId })
        .update({
          fiscal_year: fiscalYear,
          name,
          version_name: versionName,
          status,
          updated_at: db.fn.now()
        })
        .returning('*');
    } else {
      [result] = await db('budget_headers')
        .insert({
          company_id: companyId,
          fiscal_year: fiscalYear,
          name,
          version_name: versionName || 'Original',
          status: status || 'DRAFT'
        })
        .returning('*');
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Save/update budget lines
exports.saveBudgetLines = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params; // budget_header_id
  const { lines } = req.body; // array of allocation lines

  try {
    const header = await db('budget_headers').where({ id, company_id: companyId }).first();
    if (!header) return res.status(404).json({ error: 'Budget not found.' });

    await db.transaction(async (trx) => {
      // Clear previous lines
      await trx('budget_control_lines').where({ budget_header_id: id }).delete();

      for (const line of lines) {
        await trx('budget_control_lines').insert({
          budget_header_id: id,
          account_id: line.accountId,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null,
          allocated_amount: parseFloat(line.allocatedAmount || 0),
          alert_threshold_pct: parseFloat(line.alertThresholdPct || 90.00),
          control_level: line.controlLevel || 'BLOCK'
        });
      }
    });

    res.json({ message: 'Budget lines updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Copy / Roll Forward Budget
exports.copyBudget = async (req, res) => {
  const companyId = req.companyId;
  const { fromBudgetId, newFiscalYear, pctIncrease } = req.body;

  try {
    const newHeader = await BudgetService.copyBudget(
      companyId,
      parseInt(fromBudgetId),
      newFiscalYear,
      parseFloat(pctIncrease || 0)
    );
    res.json(newHeader);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Budget vs Actual Dashboard Analytics
exports.getBudgetVsActualReport = async (req, res) => {
  const companyId = req.companyId;
  const { fiscalYear, department, project, branch } = req.query;

  try {
    // 1. Resolve active budget header
    let query = db('budget_headers').where({ company_id: companyId });
    if (fiscalYear) {
      query = query.andWhere({ fiscal_year: fiscalYear });
    } else {
      query = query.andWhere({ status: 'ACTIVE' });
    }
    const header = await query.first();

    if (!header) {
      return res.json({ header: null, lines: [] });
    }

    // 2. Fetch all lines
    let lineQuery = db('budget_control_lines as bcl')
      .join('accounts as a', 'bcl.account_id', 'a.id')
      .select('bcl.*', 'a.name as account_name', 'a.code as account_code')
      .where({ 'bcl.budget_header_id': header.id });

    if (department) lineQuery = lineQuery.andWhere('bcl.department', department);
    if (project) lineQuery = lineQuery.andWhere('bcl.project', project);
    if (branch) lineQuery = lineQuery.andWhere('bcl.branch', branch);

    const lines = await lineQuery.orderBy('a.code');

    const resultLines = [];
    for (const line of lines) {
      // Sum actual spend
      const actualRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
        .sum('amount as total');
      const actual = parseFloat(actualRes[0]?.total || 0);

      // Sum committed spend
      const committedRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
        .sum('amount as total');
      const committed = parseFloat(committedRes[0]?.total || 0);

      const allocated = parseFloat(line.allocated_amount);
      const consumed = actual + committed;
      const pctUsed = allocated > 0 ? (consumed / allocated) * 100 : 0;

      resultLines.push({
        id: line.id,
        account_code: line.account_code,
        account_name: line.account_name,
        department: line.department,
        project: line.project,
        branch: line.branch,
        allocated,
        actual,
        committed,
        consumed,
        pctUsed,
        controlLevel: line.control_level
      });
    }

    res.json({
      header,
      lines: resultLines
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Budget overrides logs
exports.getBudgetOverrides = async (req, res) => {
  const companyId = req.companyId;

  try {
    const overrides = await db('workflow_instances as wi')
      .join('workflow_history as wh', 'wh.workflow_instance_id', 'wi.id')
      .leftJoin('users as u', 'wh.user_id', 'u.id')
      .select(
        'wi.document_id',
        'wi.document_type_code',
        'wh.action',
        'wh.comments',
        'u.name as actioned_by',
        'wh.created_at as actioned_at'
      )
      .where('wi.company_id', companyId)
      .andWhere('wh.stage_name', 'CFO Budget Override Approval')
      .orderBy('wh.created_at', 'desc');

    res.json(overrides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
