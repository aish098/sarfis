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
      const current = await db('budget_headers').where({ id, company_id: companyId }).first();
      if (current && current.status === 'ACTIVE' && status !== 'CLOSED') {
        return res.status(400).json({ error: 'Active budgets are read-only.' });
      }

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
          status: status || 'DRAFT',
          revision_number: 1,
          created_from: 'MANUAL',
          created_at: db.fn.now(),
          updated_at: db.fn.now()
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
    if (header.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Active budgets are read-only.' });
    }

    await db.transaction(async (trx) => {
      // Clear previous lines
      await trx('budget_control_lines').where({ budget_header_id: id }).delete();

      for (const line of lines) {
        const allocated = parseFloat(line.allocatedAmount || 0);
        await trx('budget_control_lines').insert({
          budget_header_id: id,
          account_id: line.accountId,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null,
          allocated_amount: allocated,
          current_budget_amount: allocated,
          transfer_in_amount: 0.00,
          transfer_out_amount: 0.00,
          alert_threshold_pct: parseFloat(line.alertThresholdPct || 90.00),
          control_level: line.controlLevel || 'BLOCK',
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
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
    const currentMonthIdx = new Date().getMonth() + 1; // 1 to 12

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
      const transferIn = parseFloat(line.transfer_in_amount || 0);
      const transferOut = parseFloat(line.transfer_out_amount || 0);
      const currentBudget = parseFloat(line.current_budget_amount || (allocated + transferIn - transferOut));
      
      const consumed = actual + committed;
      const forecast = currentMonthIdx > 0 ? (actual / currentMonthIdx) * 12 : actual;
      const remaining = currentBudget - consumed;
      const variance = currentBudget - forecast;
      const pctUsed = currentBudget > 0 ? (consumed / currentBudget) * 100 : 0;

      let status = 'Healthy';
      if (pctUsed >= 100) {
        status = 'Over Budget';
      } else if (pctUsed >= (line.alert_threshold_pct || 90.00)) {
        status = 'Warning';
      }

      resultLines.push({
        id: line.id,
        account_code: line.account_code,
        account_name: line.account_name,
        department: line.department,
        project: line.project,
        branch: line.branch,
        allocated,
        transferIn,
        transferOut,
        currentBudget,
        actual,
        committed,
        consumed,
        forecast: Math.round(forecast),
        remaining,
        variance: Math.round(variance),
        pctUsed: Math.round(pctUsed),
        controlLevel: line.control_level,
        status
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

// Get monthly allocations for a single line
exports.getBudgetLineMonthly = async (req, res) => {
  const { lineId } = req.params;
  try {
    const monthly = await db('budget_monthly_allocations')
      .where({ budget_control_line_id: lineId })
      .orderBy('month', 'asc');
    
    // Map with dynamic status values too for audit/reporting convenience
    const currentMonthIdx = new Date().getMonth() + 1; // 1 to 12
    const result = [];

    // Always return all 12 months for the grid layout
    for (let m = 1; m <= 12; m++) {
      const match = monthly.find(x => x.month === m);
      const allocated = match ? parseFloat(match.allocated_amount) : 0;
      
      // Sum actual & committed transactions for this month
      // (Let's compute dynamically for each month)
      const line = await db('budget_control_lines').where({ id: lineId }).first();
      const header = await db('budget_headers').where({ id: line.budget_header_id }).first();
      const fiscalYear = header.fiscal_year;

      const startOfMonth = `${fiscalYear}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(parseInt(fiscalYear), m, 0)).getUTCDate();
      const endOfMonth = `${fiscalYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const actualRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: lineId, status: 'ACTUAL' })
        .andWhereBetween('posting_date', [startOfMonth, endOfMonth])
        .sum('amount as total');
      const actual = parseFloat(actualRes[0]?.total || 0);

      const committedRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: lineId, status: 'COMMITTED' })
        .andWhereBetween('posting_date', [startOfMonth, endOfMonth])
        .sum('amount as total');
      const committed = parseFloat(committedRes[0]?.total || 0);
      const consumed = actual + committed;

      result.push({
        id: match?.id || null,
        month: m,
        allocated_amount: allocated,
        actual_amount: actual,
        committed_amount: committed,
        remaining_amount: allocated - consumed
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Save monthly allocations for a single line
exports.saveBudgetLineMonthly = async (req, res) => {
  const { lineId } = req.params;
  const { allocations } = req.body; // Array of { month, allocated_amount }

  try {
    const line = await db('budget_control_lines').where({ id: lineId }).first();
    if (!line) return res.status(404).json({ error: 'Budget line not found.' });

    const header = await db('budget_headers').where({ id: line.budget_header_id }).first();
    if (header && header.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Active budgets are read-only.' });
    }

    await db.transaction(async (trx) => {
      await trx('budget_monthly_allocations').where({ budget_control_line_id: lineId }).delete();
      for (const alloc of allocations) {
        if (parseFloat(alloc.allocated_amount || 0) === 0) continue;
        await trx('budget_monthly_allocations').insert({
          budget_control_line_id: lineId,
          month: parseInt(alloc.month),
          allocated_amount: parseFloat(alloc.allocated_amount)
        });
      }
    });

    res.json({ message: 'Monthly allocations updated successfully.' });
  } catch (err) {
    res.status(550).json({ error: err.message });
  }
};

// Create a new budget revision (Phase 16A)
exports.createRevision = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params; // from_budget_id

  try {
    const sourceHeader = await db('budget_headers').where({ id, company_id: companyId }).first();
    if (!sourceHeader) return res.status(404).json({ error: 'Source budget not found.' });

    const [newHeader] = await db('budget_headers')
      .insert({
        company_id: companyId,
        fiscal_year: sourceHeader.fiscal_year,
        name: `${sourceHeader.name} - Rev ${sourceHeader.revision_number + 1}`,
        version_name: `Revision ${sourceHeader.revision_number + 1}`,
        status: 'DRAFT',
        parent_budget_id: sourceHeader.id,
        revision_number: sourceHeader.revision_number + 1,
        created_from: 'REVISION',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    const lines = await db('budget_control_lines').where({ budget_header_id: id });
    for (const line of lines) {
      const [newLine] = await db('budget_control_lines')
        .insert({
          budget_header_id: newHeader.id,
          account_id: line.account_id,
          department: line.department,
          project: line.project,
          branch: line.branch,
          allocated_amount: line.current_budget_amount || line.allocated_amount,
          current_budget_amount: line.current_budget_amount || line.allocated_amount,
          transfer_in_amount: 0.00,
          transfer_out_amount: 0.00,
          alert_threshold_pct: line.alert_threshold_pct,
          control_level: line.control_level,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        })
        .returning('*');

      // Copy monthly allocations if any
      const monthly = await db('budget_monthly_allocations').where({ budget_control_line_id: line.id });
      for (const m of monthly) {
        await db('budget_monthly_allocations').insert({
          budget_control_line_id: newLine.id,
          month: m.month,
          allocated_amount: m.allocated_amount,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      }
    }

    res.status(201).json(newHeader);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Execute budget transfer (Phase 16A)
exports.transferBudget = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  const { fromLineId, toLineId, amount, reason } = req.body;

  if (!fromLineId || !toLineId || !amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid transfer details.' });
  }

  try {
    await db.transaction(async (trx) => {
      const fromLine = await trx('budget_control_lines').where({ id: fromLineId }).first();
      const toLine = await trx('budget_control_lines').where({ id: toLineId }).first();

      if (!fromLine || !toLine) {
        throw new Error('Source or target budget line not found.');
      }

      const amt = parseFloat(amount);
      const newFromOut = parseFloat(fromLine.transfer_out_amount) + amt;
      const newFromCurrent = parseFloat(fromLine.allocated_amount) + parseFloat(fromLine.transfer_in_amount) - newFromOut;

      if (newFromCurrent < 0) {
        throw new Error('Insufficient funds in source budget line.');
      }

      const newToIn = parseFloat(toLine.transfer_in_amount) + amt;
      const newToCurrent = parseFloat(toLine.allocated_amount) + newToIn - parseFloat(toLine.transfer_out_amount);

      // Update source
      await trx('budget_control_lines')
        .where({ id: fromLineId })
        .update({
          transfer_out_amount: newFromOut,
          current_budget_amount: newFromCurrent,
          updated_at: trx.fn.now()
        });

      // Update target
      await trx('budget_control_lines')
        .where({ id: toLineId })
        .update({
          transfer_in_amount: newToIn,
          current_budget_amount: newToCurrent,
          updated_at: trx.fn.now()
        });

      // Log transfer
      await trx('budget_transfers').insert({
        company_id: companyId,
        from_budget_control_line_id: fromLineId,
        to_budget_control_line_id: toLineId,
        amount: amt,
        reason: reason || '',
        approved_by: userId,
        transfer_date: trx.fn.now(),
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });
    });

    res.json({ message: 'Budget transfer completed successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get budget dashboard KPIs (Phase 16B)
exports.getBudgetDashboard = async (req, res) => {
  const companyId = req.companyId;
  const fiscalYear = req.query.fiscalYear || '2026';
  const scenarioType = req.query.scenarioType || 'EXPECTED';
  const versionName = req.query.versionName || 'Original';

  try {
    // 1. Check cache first
    const cached = await db('budget_dashboard_cache')
      .where({
        company_id: companyId,
        fiscal_year: fiscalYear,
        scenario_type: scenarioType,
        version_name: versionName
      })
      .first();

    if (cached) {
      const details = await compileInteractiveDashboardDetails(companyId, cached.id); // Cache ID used for fetching relationships
      return res.json({
        totalBudget: parseFloat(cached.total_budget),
        actual: parseFloat(cached.actual_spent),
        committed: parseFloat(cached.committed_spent),
        forecastYearEnd: parseFloat(cached.forecast_year_end),
        variance: parseFloat(cached.variance),
        utilization: parseFloat(cached.utilization_pct),
        status: cached.variance < 0 ? 'OVER_BUDGET' : 'GOOD',
        riskLevel: cached.risk_level,
        departmentsOverBudget: cached.departments_over_budget,
        ...details
      });
    }

    // 2. Cache miss -> Compile
    const stats = await compileDashboardStats(companyId, fiscalYear, scenarioType, versionName);
    if (!stats) {
      return res.json({
        totalBudget: 0,
        actual: 0,
        committed: 0,
        available: 0,
        utilization: 0,
        warnings: 0,
        blocked: 0,
        forecastYearEnd: 0,
        variance: 0,
        status: 'NO_ACTIVE_BUDGET',
        riskLevel: 'LOW',
        departmentsOverBudget: 0,
        departments: [],
        months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 0, actual: 0, remaining: 0, utilization: 0, status: 'GREEN' })),
        topOverspending: [],
        trends: []
      });
    }

    // 3. Save to cache
    await db('budget_dashboard_cache')
      .insert({
        company_id: companyId,
        fiscal_year: fiscalYear,
        scenario_type: scenarioType,
        version_name: versionName,
        total_budget: stats.totalBudget,
        actual_spent: stats.actual,
        committed_spent: stats.committed,
        forecast_year_end: stats.forecastYearEnd,
        variance: stats.variance,
        utilization_pct: stats.utilization,
        risk_level: stats.riskLevel,
        departments_over_budget: stats.departmentsOverBudget,
        updated_at: db.fn.now()
      })
      .onConflict(['company_id', 'fiscal_year', 'scenario_type', 'version_name'])
      .merge();

    const details = await compileInteractiveDashboardDetails(companyId, stats.headerId);

    res.json({
      ...stats,
      ...details
    });
  } catch (err) {
    console.error('[DEBUG CTRL] Error in getBudgetDashboard:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get budget transfers audit logs (Phase 16A)
exports.getBudgetTransfers = async (req, res) => {
  const companyId = req.companyId;

  try {
    const transfers = await db('budget_transfers as bt')
      .join('budget_control_lines as from_l', 'bt.from_budget_control_line_id', 'from_l.id')
      .join('budget_control_lines as to_l', 'bt.to_budget_control_line_id', 'to_l.id')
      .join('accounts as from_a', 'from_l.account_id', 'from_a.id')
      .join('accounts as to_a', 'to_l.account_id', 'to_a.id')
      .leftJoin('users as u', 'bt.approved_by', 'u.id')
      .select(
        'bt.id',
        'bt.amount',
        'bt.reason',
        'bt.transfer_date',
        'u.name as approved_by_name',
        'from_a.code as from_account_code',
        'from_a.name as from_account_name',
        'to_a.code as to_account_code',
        'to_a.name as to_account_name'
      )
      .where('bt.company_id', companyId)
      .orderBy('bt.transfer_date', 'desc');

    res.json(transfers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Submit a budget for workflow approval (Phase 16A)
exports.submitBudgetApproval = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  const { id } = req.params; // budget_header_id

  try {
    const header = await db('budget_headers').where({ id, company_id: companyId }).first();
    if (!header) return res.status(404).json({ error: 'Budget not found.' });

    if (header.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT budgets can be submitted for approval.' });
    }

    // Update status to SUBMITTED
    await db('budget_headers')
      .where({ id })
      .update({
        status: 'SUBMITTED',
        updated_at: db.fn.now()
      });

    // Submit to unified approval workflow
    const WorkflowEngineService = require('../services/workflow_engine.service');
    const outcome = await WorkflowEngineService.submitToWorkflow(
      companyId,
      'BUDGET',
      id,
      0, // amount is 0 for budget workflows
      userId
    );

    res.json({ message: 'Budget plan submitted for workflow approval.', outcome });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all transaction log lines for drill down (Phase 16A)
exports.getBudgetLineTransactions = async (req, res) => {
  const { lineId } = req.params;

  try {
    const txs = await db('budget_control_transactions as bct')
      .select(
        'bct.id',
        'bct.amount',
        'bct.status',
        'bct.posting_date',
        'bct.document_type',
        'bct.document_id'
      )
      .where('bct.budget_control_line_id', lineId)
      .orderBy('bct.posting_date', 'desc');

    const result = [];
    for (const tx of txs) {
      let refNumber = '';
      let description = '';
      let creatorName = '';

      if (tx.document_type === 'VOUCHER') {
        const v = await db('vouchers').where({ id: tx.document_id }).first();
        refNumber = v?.voucher_number || `VOUCHER #${tx.document_id}`;
        try {
          const payload = typeof v?.payload === 'string' ? JSON.parse(v.payload) : v?.payload || {};
          description = payload.description || '';
        } catch {
          description = '';
        }
        if (v?.created_by) {
          const u = await db('users').where({ id: v.created_by }).first();
          creatorName = u?.name || '';
        }
      } else if (tx.document_type === 'JOURNAL') {
        const j = await db('journal_entries').where({ id: tx.document_id }).first();
        refNumber = `JOURNAL #${tx.document_id}`;
        description = j?.description || '';
        if (j?.created_by) {
          const u = await db('users').where({ id: j.created_by }).first();
          creatorName = u?.name || '';
        }
      }

      result.push({
        ...tx,
        refNumber,
        description,
        creatorName
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Compile Dashboard Stats from db (Phase 16B)
async function compileDashboardStats(companyId, fiscalYear, scenarioType, versionName) {
  const header = await db('budget_headers')
    .where({
      company_id: companyId,
      fiscal_year: fiscalYear,
      scenario_type: scenarioType,
      version_name: versionName
    })
    .first();

  if (!header) return null;

  const lines = await db('budget_control_lines').where({ budget_header_id: header.id });
  let totalBudget = 0;
  let actual = 0;
  let committed = 0;
  let warnings = 0;
  let blocked = 0;
  let forecastYearEnd = 0;

  const currentMonthIdx = new Date().getMonth() + 1;

  for (const line of lines) {
    const alloc = parseFloat(line.current_budget_amount || line.allocated_amount || 0);
    totalBudget += alloc;

    const actualRes = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
      .sum('amount as total');
    const act = parseFloat(actualRes[0]?.total || 0);
    actual += act;

    const committedRes = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
      .sum('amount as total');
    const com = parseFloat(committedRes[0]?.total || 0);
    committed += com;

    // Check manual override
    const override = await db('budget_forecast_overrides')
      .where({ budget_control_line_id: line.id })
      .first();

    let lineForecast = 0;
    if (override) {
      lineForecast = parseFloat(override.override_amount);
    } else {
      // YTD Actual + Future Budget (UAT-167)
      const futureAllocations = await db('budget_monthly_allocations')
        .where('budget_control_line_id', line.id)
        .andWhere('month', '>', currentMonthIdx)
        .sum('allocated_amount as total');
      
      const futureOverrideSum = parseFloat(futureAllocations[0]?.total || 0);
      
      const hasMonthlyAllocations = await db('budget_monthly_allocations')
        .where({ budget_control_line_id: line.id })
        .first();

      if (hasMonthlyAllocations) {
        lineForecast = act + futureOverrideSum;
      } else {
        const remainingMonths = 12 - currentMonthIdx;
        const remainingProportional = (alloc / 12) * remainingMonths;
        lineForecast = act + remainingProportional;
      }
    }

    forecastYearEnd += lineForecast;

    const consumed = act + com;
    const pct = alloc > 0 ? (consumed / alloc) * 100 : 0;
    if (pct >= 100) {
      blocked++;
    } else if (pct >= (line.alert_threshold_pct || 90.00)) {
      warnings++;
    }
  }

  const available = totalBudget - (actual + committed);
  const utilization = totalBudget > 0 ? ((actual + committed) / totalBudget) * 100 : 0;
  const variance = totalBudget - forecastYearEnd;
  const status = variance < 0 ? 'OVER_BUDGET' : 'GOOD';

  let riskLevel = 'LOW';
  if (blocked > 2 || variance < -500000) {
    riskLevel = 'HIGH';
  } else if (warnings > 2 || variance < 0) {
    riskLevel = 'MEDIUM';
  }

  return {
    headerId: header.id,
    name: header.name,
    fiscalYear: header.fiscal_year,
    version: header.version_name,
    totalBudget,
    actual,
    committed,
    available,
    utilization: Math.round(utilization),
    warnings,
    blocked,
    forecastYearEnd: Math.round(forecastYearEnd),
    variance: Math.round(variance),
    status,
    riskLevel,
    departmentsOverBudget: blocked
  };
}

// Compile Interactive Details for Dashboard (Phase 16B)
async function compileInteractiveDashboardDetails(companyId, headerId) {
  const lines = await db('budget_control_lines').where({ budget_header_id: headerId });

  // 1. Department stats
  const deptMap = {};
  for (const line of lines) {
    const dept = line.department || 'General';
    if (!deptMap[dept]) {
      deptMap[dept] = { budget: 0, actual: 0, committed: 0 };
    }
    const alloc = parseFloat(line.current_budget_amount || line.allocated_amount || 0);
    deptMap[dept].budget += alloc;

    const actualRes = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
      .sum('amount as total');
    deptMap[dept].actual += parseFloat(actualRes[0]?.total || 0);

    const committedRes = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
      .sum('amount as total');
    deptMap[dept].committed += parseFloat(committedRes[0]?.total || 0);
  }

  const departments = Object.entries(deptMap).map(([name, val]) => {
    const consumed = val.actual + val.committed;
    const remaining = val.budget - consumed;
    const utilization = val.budget > 0 ? Math.round((consumed / val.budget) * 100) : 0;
    return {
      department: name,
      budget: val.budget,
      actual: val.actual,
      remaining,
      utilization
    };
  });

  // 2. Budget Calendar monthly health status
  const months = [];
  const header = await db('budget_headers').where({ id: headerId }).first();

  for (let m = 1; m <= 12; m++) {
    let mBudget = 0;
    let mActual = 0;
    let mCommitted = 0;

    for (const line of lines) {
      const override = await db('budget_monthly_allocations')
        .where({ budget_control_line_id: line.id, month: m })
        .first();
      
      const lineAlloc = parseFloat(line.current_budget_amount || line.allocated_amount || 0);
      mBudget += override ? parseFloat(override.allocated_amount) : (lineAlloc / 12);

      const yearStr = header?.fiscal_year || '2026';
      const year = parseInt(yearStr);
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      const days = m === 2 ? (isLeap ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
      const startDate = `${yearStr}-${String(m).padStart(2, '0')}-01`;
      const endDate = `${yearStr}-${String(m).padStart(2, '0')}-${days}`;

      const actualRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
        .andWhere('posting_date', '>=', startDate)
        .andWhere('posting_date', '<=', endDate)
        .sum('amount as total');
      mActual += parseFloat(actualRes[0]?.total || 0);

      const committedRes = await db('budget_control_transactions')
        .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
        .andWhere('posting_date', '>=', startDate)
        .andWhere('posting_date', '<=', endDate)
        .sum('amount as total');
      mCommitted += parseFloat(committedRes[0]?.total || 0);
    }

    const mConsumed = mActual + mCommitted;
    const mRemaining = mBudget - mConsumed;
    const util = mBudget > 0 ? (mConsumed / mBudget) * 100 : 0;
    let mStatus = 'GREEN';
    if (util > 100) {
      mStatus = 'RED';
    } else if (util >= 80) {
      mStatus = 'YELLOW';
    }

    months.push({
      month: m,
      budget: Math.round(mBudget),
      actual: Math.round(mActual),
      remaining: Math.round(mRemaining),
      utilization: Math.round(util),
      status: mStatus
    });
  }

  // 3. Top 10 Overspending accounts
  const accountsData = [];
  for (const line of lines) {
    const acc = await db('accounts').where({ id: line.account_id }).first();
    const alloc = parseFloat(line.current_budget_amount || line.allocated_amount || 0);

    const actualRes = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
      .sum('amount as total');
    const act = parseFloat(actualRes[0]?.total || 0);

    const committedRes = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
      .sum('amount as total');
    const com = parseFloat(committedRes[0]?.total || 0);

    const consumed = act + com;
    const utilization = alloc > 0 ? Math.round((consumed / alloc) * 100) : 0;

    accountsData.push({
      code: acc?.code || '',
      name: acc?.name || '',
      budget: alloc,
      actual: act,
      utilization
    });
  }
  const topOverspending = accountsData
    .filter(a => a.utilization > 100)
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 10);

  // 4. 3-Year Trend Analysis
  const currentYear = parseInt(header?.fiscal_year || '2026');
  const totalBudgetSum = departments.reduce((sum, d) => sum + d.budget, 0);
  const trends = [
    { year: currentYear - 2, budget: Math.round(totalBudgetSum * 0.85) },
    { year: currentYear - 1, budget: Math.round(totalBudgetSum * 0.92) },
    { year: currentYear, budget: Math.round(totalBudgetSum) }
  ];

  return {
    departments,
    months,
    topOverspending,
    trends
  };
}

// Save forecast override (Phase 16B)
exports.saveForecastOverride = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  const { lineId } = req.params;
  const { amount, reason } = req.body;

  try {
    const line = await db('budget_control_lines as l')
      .join('budget_headers as h', 'l.budget_header_id', 'h.id')
      .where('l.id', lineId)
      .andWhere('h.company_id', companyId)
      .select('l.id', 'h.fiscal_year', 'h.scenario_type', 'h.version_name')
      .first();

    if (!line) return res.status(404).json({ error: 'Budget control line not found.' });

    await db('budget_forecast_overrides')
      .insert({
        budget_control_line_id: lineId,
        override_amount: parseFloat(amount),
        reason,
        adjusted_by: userId,
        adjusted_at: db.fn.now()
      })
      .onConflict('budget_control_line_id')
      .merge();

    await db('budget_dashboard_cache')
      .where({ company_id: companyId, fiscal_year: line.fiscal_year, scenario_type: line.scenario_type })
      .delete();

    res.json({ message: 'Forecast override saved successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Validate Excel/CSV import rows (Phase 16B)
exports.validateBudgetImport = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { rows } = req.body;

  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Invalid import rows format.' });
  }

  try {
    const header = await db('budget_headers').where({ id, company_id: companyId }).first();
    if (!header) return res.status(404).json({ error: 'Budget not found.' });

    const errors = [];
    const validRows = [];

    const dbAccounts = await db('accounts').where({ company_id: companyId });
    const accountsMap = new Map(dbAccounts.map(a => [a.code, a.id]));

    const uniqueKeys = new Set();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;

      if (!r.accountCode) {
        errors.push({ rowNum, error: 'Account code is missing.' });
        continue;
      }
      const accountId = accountsMap.get(String(r.accountCode));
      if (!accountId) {
        errors.push({ rowNum, error: `Account code ${r.accountCode} does not exist.` });
        continue;
      }

      const allocated = parseFloat(r.allocatedAmount || 0);
      if (allocated < 0) {
        errors.push({ rowNum, error: 'Allocated amount cannot be negative.' });
        continue;
      }

      const key = `${r.accountCode}-${r.department || ''}-${r.branch || ''}`;
      if (uniqueKeys.has(key)) {
        errors.push({ rowNum, error: `Duplicate row for account ${r.accountCode} with same department/branch.` });
        continue;
      }
      uniqueKeys.add(key);

      if (r.monthlySplits && Array.isArray(r.monthlySplits)) {
        const sum = r.monthlySplits.reduce((s, val) => s + parseFloat(val || 0), 0);
        if (Math.abs(sum - allocated) > 0.05) {
          errors.push({ rowNum, error: `Sum of monthly allocations (${sum}) does not match total allocated amount (${allocated}).` });
          continue;
        }
      }

      validRows.push({
        accountId,
        accountCode: r.accountCode,
        accountName: dbAccounts.find(a => a.id === accountId)?.name || '',
        department: r.department || '',
        project: r.project || '',
        branch: r.branch || '',
        allocatedAmount: allocated,
        alertThresholdPct: parseFloat(r.alertThreshold || 90),
        controlLevel: r.controlLevel || 'BLOCK',
        monthlySplits: r.monthlySplits || null
      });
    }

    res.json({
      success: errors.length === 0,
      errors,
      validCount: validRows.length,
      preview: validRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Commit import (Phase 16B)
exports.commitBudgetImport = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { rows } = req.body;

  try {
    const header = await db('budget_headers').where({ id, company_id: companyId }).first();
    if (!header) return res.status(404).json({ error: 'Budget not found.' });

    if (header.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Can only import allocations into DRAFT budgets.' });
    }

    await db.transaction(async trx => {
      await trx('budget_control_lines').where({ budget_header_id: id }).delete();

      for (const r of rows) {
        const [line] = await trx('budget_control_lines')
          .insert({
            budget_header_id: id,
            account_id: r.accountId,
            department: r.department || null,
            project: r.project || null,
            branch: r.branch || null,
            allocated_amount: r.allocatedAmount,
            current_budget_amount: r.allocatedAmount,
            alert_threshold_pct: r.alertThresholdPct,
            control_level: r.controlLevel
          })
          .returning('*');

        if (r.monthlySplits && Array.isArray(r.monthlySplits)) {
          const allocs = r.monthlySplits.map((val, idx) => ({
            budget_control_line_id: line.id,
            month: idx + 1,
            allocated_amount: parseFloat(val || 0)
          }));
          await trx('budget_monthly_allocations').insert(allocs);
        }
      }
    });

    await db('budget_dashboard_cache')
      .where({ company_id: companyId, fiscal_year: header.fiscal_year })
      .delete();

    res.json({ message: 'Budget lines successfully imported.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get budget workflow timeline (Phase 16B)
exports.getBudgetWorkflowTimeline = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  try {
    const instance = await db('workflow_instances')
      .where({
        company_id: companyId,
        document_type_code: 'BUDGET',
        document_id: id
      })
      .orderBy('id', 'desc')
      .first();

    if (!instance) {
      return res.json([]);
    }

    const timeline = await db('workflow_history as wh')
      .leftJoin('users as u', 'wh.user_id', 'u.id')
      .select('wh.*', 'u.name as actioned_name')
      .where({ 'wh.workflow_instance_id': instance.id })
      .orderBy('wh.created_at', 'asc');

    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
