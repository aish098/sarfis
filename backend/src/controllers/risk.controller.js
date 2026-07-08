const RiskService = require('../services/risk.service');
const RiskModel = require('../models/risk.model');
const db = require('../config/db');

exports.getStatus = async (req, res) => {
  const { entityType, entityId } = req.params;
  const companyId = req.companyId;

  try {
    const status = await RiskModel.getOrCreateStatus(companyId, entityType, parseInt(entityId));
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logIncident = async (req, res) => {
  const { entityType, entityId, category, incidentDate, reason, lossAmount, recoveredAmount, daysLate, notes, resolved } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const result = await RiskService.logIncident(companyId, entityType, parseInt(entityId), {
      category, incidentDate, reason, lossAmount, recoveredAmount, daysLate, notes, resolved
    }, userId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.resolveIncident = async (req, res) => {
  const { incidentId } = req.params;
  const { recoveredAmount, notes } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const result = await RiskService.resolveIncident(companyId, parseInt(incidentId), { recoveredAmount, notes }, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.blacklistEntity = async (req, res) => {
  const { entityType, entityId, untilDate, reason, notes } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await RiskService.blacklistEntity(companyId, entityType, parseInt(entityId), { untilDate, reason, notes }, userId);
    res.json({ message: 'Relationship blacklisted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.warnEntity = async (req, res) => {
  const { entityType, entityId, reason, notes } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await RiskService.warnEntity(companyId, entityType, parseInt(entityId), { reason, notes }, userId);
    res.json({ message: 'Relationship warned successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.requestReinstatement = async (req, res) => {
  const { entityType, entityId, reason } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const request = await RiskService.requestReinstatement(companyId, entityType, parseInt(entityId), { reason }, userId);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.reviewReinstatement = async (req, res) => {
  const { requestId } = req.params;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await RiskService.reviewReinstatement(companyId, parseInt(requestId), req.body, userId);
    res.json({ message: 'Reinstatement review submitted successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getHistory = async (req, res) => {
  const { entityType, entityId } = req.params;
  const companyId = req.companyId;

  try {
    const history = await RiskModel.getHistory(companyId, entityType, parseInt(entityId));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getIncidentsList = async (req, res) => {
  const { entityType, entityId } = req.params;
  const companyId = req.companyId;

  try {
    const list = await RiskModel.getIncidents(companyId, entityType, parseInt(entityId));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPaymentPlans = async (req, res) => {
  const { entityType, entityId } = req.params;
  const companyId = req.companyId;

  try {
    const plans = await RiskModel.getPaymentPlans(companyId, entityType, parseInt(entityId));
    
    // Add installments to each plan
    const result = [];
    for (let plan of plans) {
      const installments = await RiskModel.getPaymentPlanInstallments(plan.id);
      result.push({ ...plan, installments });
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.payPaymentPlanInstallment = async (req, res) => {
  const { installmentId } = req.params;
  const { amount } = req.body;

  try {
    await RiskModel.payInstallment(parseInt(installmentId), parseFloat(amount));
    res.json({ message: 'Installment payment recorded.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  const companyId = req.companyId;

  try {
    // 1. Counts from relationship statuses
    const activeRiskLevels = await db('business_relationship_status')
      .where('company_id', companyId)
      .whereIn('risk_level', ['HIGH', 'CRITICAL'])
      .count('* as count').first();

    const blacklisted = await db('business_relationship_status')
      .where({ company_id: companyId, status: 'BLACKLISTED' })
      .count('* as count').first();

    const watchlist = await db('business_relationship_status')
      .where({ company_id: companyId, status: 'WATCHLIST' })
      .count('* as count').first();

    const pendingReinstatements = await db('reinstatement_requests')
      .where({ company_id: companyId, status: 'PENDING' })
      .count('* as count').first();

    // 2. Financial totals from incidents
    const totals = await db('business_risk_incidents')
      .where('company_id', companyId)
      .select(
        db.raw('COALESCE(SUM(loss_amount), 0) as total_loss'),
        db.raw('COALESCE(SUM(recovered_amount), 0) as total_recovered')
      ).first();

    const totalLoss = parseFloat(totals?.total_loss || 0);
    const totalRecovered = parseFloat(totals?.total_recovered || 0);
    const outstandingBadDebt = Math.max(0, totalLoss - totalRecovered);

    // 3. Average recovery time in days (incident_date to resolved_at)
    const resolved = await db('business_risk_incidents')
      .where({ company_id: companyId, resolved: true })
      .select('incident_date', 'resolved_at');

    let totalDays = 0;
    let resolvedCount = 0;

    for (let r of resolved) {
      if (r.resolved_at) {
        const start = new Date(r.incident_date);
        const end = new Date(r.resolved_at);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDays += diffDays;
        resolvedCount++;
      }
    }

    const avgRecoveryTime = resolvedCount > 0 ? Math.round(totalDays / resolvedCount) : 0;

    res.json({
      customersAtRisk: parseInt(activeRiskLevels?.count || 0),
      blacklisted: parseInt(blacklisted?.count || 0),
      watchlist: parseInt(watchlist?.count || 0),
      pendingReinstatements: parseInt(pendingReinstatements?.count || 0),
      recoveredDebt: totalRecovered,
      outstandingBadDebt,
      averageRecoveryTime: avgRecoveryTime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBlacklistedReport = async (req, res) => {
  const companyId = req.companyId;

  try {
    const list = await db('business_relationship_status as s')
      .where({ 's.company_id': companyId })
      .whereIn('s.status', ['BLACKLISTED', 'WATCHLIST', 'RESTRICTED'])
      .select('s.*');
      
    // Fetch details for clients and vendors
    const result = [];
    for (let s of list) {
      let name = '';
      if (s.entity_type === 'CUSTOMER') {
        const c = await db('clients').where({ id: s.entity_id }).first();
        name = c ? c.name : 'Unknown';
      } else {
        const v = await db('vendors').where({ id: s.entity_id }).first();
        name = v ? v.name : 'Unknown';
      }
      result.push({ ...s, partner_name: name });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBadDebtReport = async (req, res) => {
  const companyId = req.companyId;

  try {
    const list = await db('business_risk_incidents as i')
      .where({ 'i.company_id': companyId })
      .orderBy('i.incident_date', 'desc');

    const result = [];
    for (let i of list) {
      let name = '';
      if (i.entity_type === 'CUSTOMER') {
        const c = await db('clients').where({ id: i.entity_id }).first();
        name = c ? c.name : 'Unknown';
      } else {
        const v = await db('vendors').where({ id: i.entity_id }).first();
        name = v ? v.name : 'Unknown';
      }
      result.push({ ...i, partner_name: name });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReinstatementReport = async (req, res) => {
  const companyId = req.companyId;

  try {
    const list = await db('reinstatement_requests as r')
      .leftJoin('users as u', 'r.reviewed_by', 'u.id')
      .where({ 'r.company_id': companyId })
      .select('r.*', 'u.name as reviewer_name')
      .orderBy('r.created_at', 'desc');

    const result = [];
    for (let r of list) {
      let name = '';
      if (r.entity_type === 'CUSTOMER') {
        const c = await db('clients').where({ id: r.entity_id }).first();
        name = c ? c.name : 'Unknown';
      } else {
        const v = await db('vendors').where({ id: r.entity_id }).first();
        name = v ? v.name : 'Unknown';
      }
      result.push({ ...r, partner_name: name });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyOverride = async (req, res) => {
  const { email, password } = req.body;
  const companyId = req.companyId;

  try {
    const bcrypt = require('bcrypt');
    const userRecord = await db('users').where({ email }).first();
    if (!userRecord) return res.status(401).json({ error: 'Invalid supervisor credentials.' });

    const match = await bcrypt.compare(password, userRecord.password);
    if (!match) return res.status(401).json({ error: 'Incorrect supervisor password.' });

    // Verify role/permission
    const RoleService = require('../services/role.service');
    const permissions = await RoleService.getUserPermissions(userRecord.id, companyId);
    if (!permissions.includes('risk.approve') && userRecord.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Supervisor does not have override permission.' });
    }

    res.json({ success: true, userId: userRecord.id, name: userRecord.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitApprovalRequest = async (req, res) => {
  const { entityType, entityId, requestType, voucherId, reason, metadata, entityName } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const result = await RiskService.submitApprovalRequest(companyId, entityType, parseInt(entityId), {
      requestType, voucherId, reason, metadata, entityName
    }, userId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPendingApprovalRequests = async (req, res) => {
  const companyId = req.companyId;

  try {
    const list = await RiskModel.getPendingApprovalRequests(companyId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reviewApprovalRequest = async (req, res) => {
  const { requestId } = req.params;
  const { status, reviewNotes } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await RiskService.reviewApprovalRequest(companyId, parseInt(requestId), { status, reviewNotes }, userId);
    res.json({ message: 'Override request review recorded successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.triggerScheduledReviews = async (req, res) => {
  const companyId = req.companyId;

  try {
    await RiskService.runScheduledReviews(companyId);
    res.json({ message: 'Scheduled reassessment reviews completed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApprovalRequest = async (req, res) => {
  const { requestId } = req.params;
  const companyId = req.companyId;

  const idVal = parseInt(requestId);
  if (isNaN(idVal)) {
    return res.status(400).json({ error: 'Invalid approval request ID.' });
  }

  try {
    const request = await RiskModel.getApprovalRequestById(idVal, companyId);
    if (!request) {
      return res.status(404).json({ error: 'Approval request not found.' });
    }
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReinstatementRequests = async (req, res) => {
  const { entityType, entityId } = req.params;
  const companyId = req.companyId;

  try {
    const list = await RiskModel.getReinstatementRequests(companyId, entityType, parseInt(entityId));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRiskSettings = async (req, res) => {
  const companyId = req.companyId;

  try {
    const cached = await RiskService.getCachedRules(companyId);
    const history = await RiskModel.getPolicyHistory(companyId);
    res.json({
      rules: cached.rules,
      levels: cached.levels,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRiskRule = async (req, res) => {
  const { ruleId } = req.params;
  const { weight, enabled, reason } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const rules = await RiskModel.getRiskRules(companyId);
    const rule = rules.find(r => r.id === parseInt(ruleId));
    if (!rule) {
      return res.status(404).json({ error: 'Risk rule not found.' });
    }

    const oldVal = `Weight: ${rule.weight}, Enabled: ${rule.enabled}`;
    const newVal = `Weight: ${weight !== undefined ? weight : rule.weight}, Enabled: ${enabled !== undefined ? enabled : rule.enabled}`;

    await db.transaction(async (trx) => {
      await RiskModel.updateRiskRule(parseInt(ruleId), companyId, {
        weight: weight !== undefined ? parseInt(weight) : rule.weight,
        enabled: enabled !== undefined ? !!enabled : rule.enabled,
        updatedBy: userId
      }, trx);

      await RiskModel.addPolicyHistory(
        companyId,
        'RULE_CHANGE',
        parseInt(ruleId),
        oldVal,
        newVal,
        userId,
        reason || 'Policy configuration update',
        trx
      );
    });

    RiskService.invalidateCache(companyId);
    RiskService.triggerBackgroundRecalculation(companyId);

    res.json({ success: true, message: 'Risk rule updated successfully. Bulk recalculation started in the background.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateRiskLevels = async (req, res) => {
  const { levels, reason } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    if (!Array.isArray(levels) || levels.length !== 4) {
      throw new Error('Exactly 4 risk levels must be configured.');
    }

    RiskService.validateThresholds(levels);

    const oldLevels = await RiskModel.getRiskLevels(companyId);

    await db.transaction(async (trx) => {
      for (const lvl of levels) {
        const oldLvl = oldLevels.find(o => o.id === parseInt(lvl.id));
        if (!oldLvl) throw new Error(`Risk level rules ID #${lvl.id} not found.`);

        await RiskModel.updateRiskLevel(parseInt(lvl.id), companyId, {
          min_score: parseInt(lvl.min_score),
          max_score: parseInt(lvl.max_score)
        }, trx);

        const oldVal = `${oldLvl.min_score}-${oldLvl.max_score}`;
        const newVal = `${lvl.min_score}-${lvl.max_score}`;

        if (oldVal !== newVal) {
          await RiskModel.addPolicyHistory(
            companyId,
            'THRESHOLD_CHANGE',
            parseInt(lvl.id),
            oldVal,
            newVal,
            userId,
            reason || `Adjusted risk thresholds for ${lvl.risk_level}`,
            trx
          );
        }
      }
    });

    RiskService.invalidateCache(companyId);
    RiskService.triggerBackgroundRecalculation(companyId);

    res.json({ success: true, message: 'Risk thresholds updated successfully. Bulk recalculation started in the background.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
