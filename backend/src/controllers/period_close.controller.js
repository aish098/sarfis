const db = require('../config/db');
const PeriodCloseService = require('../services/period_close.service');
const PeriodCloseReportService = require('../services/period_close_report.service');

exports.getCloseDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const userId = req.user.id;
    const dashboard = await PeriodCloseService.getCloseDashboard(companyId, parseInt(id), userId);
    res.json(dashboard);
  } catch (err) {
    console.error('getCloseDashboard error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getFinancialSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const summary = await PeriodCloseService.getFinancialSummary(companyId, parseInt(id));
    res.json(summary);
  } catch (err) {
    console.error('getFinancialSummary error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getModuleHealth = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const health = await PeriodCloseService.getModuleHealth(companyId, parseInt(id));
    res.json(health);
  } catch (err) {
    console.error('getModuleHealth error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const timeline = await PeriodCloseService.getCloseTimeline(companyId, parseInt(id));
    res.json(timeline);
  } catch (err) {
    console.error('getTimeline error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSignoffs = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const session = await PeriodCloseService.getOrCreateSession(companyId, parseInt(id), req.user.id);
    
    const signoffs = await db('period_close_signoffs as pcs')
      .join('users as u', 'pcs.user_id', 'u.id')
      .select('pcs.*', 'u.name as checker_name')
      .where({ 'pcs.session_id': session.id });

    res.json({ session, signoffs });
  } catch (err) {
    console.error('getSignoffs error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.saveSignoff = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, checked } = req.body;
    const companyId = req.companyId;
    const userId = req.user.id;

    const session = await PeriodCloseService.getOrCreateSession(companyId, parseInt(id), userId);

    if (checked) {
      const [signoff] = await db('period_close_signoffs')
        .insert({
          company_id: companyId,
          session_id: session.id,
          step,
          checked: true,
          user_id: userId,
          checked_at: db.fn.now()
        })
        .onConflict(['session_id', 'step'])
        .merge({
          checked: true,
          user_id: userId,
          checked_at: db.fn.now()
        })
        .returning('*');

      res.json(signoff);
    } else {
      await db('period_close_signoffs')
        .where({ session_id: session.id, step })
        .delete();
      res.json({ message: 'Sign-off removed successfully' });
    }
  } catch (err) {
    console.error('saveSignoff error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.startSession = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const session = await PeriodCloseService.getOrCreateSession(companyId, parseInt(id), req.user.id);
    res.json(session);
  } catch (err) {
    console.error('startSession error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.submitCloseApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const userId = req.user.id;

    const session = await PeriodCloseService.getOrCreateSession(companyId, parseInt(id), userId);
    
    // Validate readiness
    const checklist = await PeriodCloseService.getChecklist(companyId, parseInt(id));
    if (checklist.blockers.length > 0) {
      return res.status(400).json({ error: 'Cannot submit for approval. Blockers exist.' });
    }

    // Verify all stakeholder sign-offs are complete
    const requiredSteps = ['INVENTORY', 'PAYROLL', 'BANK_REC', 'GL_CONTROL', 'BUDGET', 'TRIAL_BALANCE'];
    const signoffs = await db('period_close_signoffs').where({ session_id: session.id, checked: true });
    const signedSteps = signoffs.map(s => s.step);
    const missingSteps = requiredSteps.filter(s => !signedSteps.includes(s));
    
    if (missingSteps.length > 0) {
      return res.status(400).json({ error: `Cannot submit for approval. Missing stakeholder sign-offs: ${missingSteps.join(', ')}` });
    }

    // Update status to PENDING_APPROVAL
    await db('period_close_sessions')
      .where({ id: session.id })
      .update({ status: 'PENDING_APPROVAL', updated_at: db.fn.now() });

    // Submit to Workflows engine
    const WorkflowEngineService = require('../services/workflow_engine.service');
    const workflow = await WorkflowEngineService.submitToWorkflow(
      companyId,
      'PERIOD_CLOSE',
      session.id,
      0, // Period closing has no financial amount parameter
      userId
    );

    res.json({ message: 'Close workflow submitted successfully', workflow });
  } catch (err) {
    console.error('submitCloseApproval error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'pdf' or 'json'
    const companyId = req.companyId;

    const session = await db('period_close_sessions')
      .where({ company_id: companyId, period_id: parseInt(id) })
      .orderBy('created_at', 'desc')
      .first();

    if (!session) return res.status(404).json({ error: 'Close session not found.' });

    const snapshot = await db('period_close_snapshots')
      .where({ session_id: session.id })
      .first();

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Period_Close_Report_${id}.pdf`);
      await PeriodCloseReportService.generateCloseReportPDF(companyId, parseInt(id), session, snapshot, res);
    } else {
      const jsonReport = await PeriodCloseReportService.generateCloseReportJSON(companyId, parseInt(id), session, snapshot);
      res.json(jsonReport);
    }
  } catch (err) {
    console.error('getReport error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.closePeriodDirectly = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const userId = req.user.id;
    const closedPeriod = await PeriodCloseService.closePeriod(parseInt(id), companyId, userId);
    res.json({ message: 'Period closed and locked successfully', period: closedPeriod });
  } catch (err) {
    console.error('closePeriodDirectly error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.reopenPeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const companyId = req.companyId;
    const userId = req.user.id;
    const openedPeriod = await PeriodCloseService.reopenPeriod(parseInt(id), companyId, userId, reason);
    res.json({ message: 'Period reopened successfully', period: openedPeriod });
  } catch (err) {
    console.error('reopenPeriod error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.getChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const checklist = await PeriodCloseService.getChecklist(companyId, parseInt(id));
    res.json(checklist);
  } catch (err) {
    console.error('getChecklist error:', err);
    res.status(500).json({ error: err.message });
  }
};
