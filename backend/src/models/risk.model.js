const db = require('../config/db');

class RiskModel {
  static async getOrCreateStatus(companyId, entityType, entityId, trx) {
    const RiskService = require('../services/risk.service');
    await RiskService.ensureCompanyRulesInitialized(companyId, trx);

    const query = db('business_relationship_status')
      .where({ company_id: companyId, entity_type: entityType, entity_id: entityId });
    if (trx) query.transacting(trx);

    let status = await query.first();
    if (!status) {
      const insertQuery = db('business_relationship_status');
      if (trx) insertQuery.transacting(trx);

      const [newStatus] = await insertQuery.insert({
        company_id: companyId,
        entity_type: entityType,
        entity_id: entityId,
        status: 'ACTIVE',
        risk_score: 0,
        risk_level: 'LOW',
        cash_only: false,
        manager_approval_required: false
      }).returning('*');
      status = newStatus;
    }
    return status;
  }

  static async updateStatus(companyId, entityType, entityId, data, trx) {
    const query = db('business_relationship_status')
      .where({ company_id: companyId, entity_type: entityType, entity_id: entityId });
    if (trx) query.transacting(trx);

    const [updated] = await query
      .update({
        ...data,
        updated_at: db.fn.now()
      })
      .returning('*');
    return updated;
  }

  static async getIncidents(companyId, entityType, entityId, trx) {
    const query = db('business_risk_incidents')
      .where({ company_id: companyId, entity_type: entityType, entity_id: entityId })
      .orderBy('incident_date', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async insertIncident(incident, trx) {
    const query = db('business_risk_incidents');
    if (trx) query.transacting(trx);
    const [inserted] = await query.insert(incident).returning('*');
    return inserted;
  }

  static async getIncidentById(id, companyId, trx) {
    const query = db('business_risk_incidents')
      .where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    return query.first();
  }

  static async updateIncident(id, companyId, data, trx) {
    const query = db('business_risk_incidents')
      .where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    const [updated] = await query.update(data).returning('*');
    return updated;
  }

  static async getReinstatementRequests(companyId, entityType, entityId, trx) {
    const query = db('reinstatement_requests as r')
      .leftJoin('users as u', 'r.reviewed_by', 'u.id')
      .where({ 'r.company_id': companyId, 'r.entity_type': entityType, 'r.entity_id': entityId })
      .select('r.*', 'u.name as reviewer_name')
      .orderBy('r.created_at', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async getReinstatementRequestById(id, companyId, trx) {
    const query = db('reinstatement_requests')
      .where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    return query.first();
  }

  static async insertReinstatementRequest(request, trx) {
    const query = db('reinstatement_requests');
    if (trx) query.transacting(trx);
    const [inserted] = await query.insert(request).returning('*');
    return inserted;
  }

  static async updateReinstatementRequest(id, companyId, data, trx) {
    const query = db('reinstatement_requests')
      .where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    const [updated] = await query.update(data).returning('*');
    return updated;
  }

  static async createPaymentPlan(companyId, entityType, entityId, totalAmount, frequency, createdBy, installments, trx) {
    const planQuery = db('payment_plans');
    if (trx) planQuery.transacting(trx);

    const [plan] = await planQuery.insert({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      total_amount: totalAmount,
      frequency,
      status: 'ACTIVE',
      created_by: createdBy
    }).returning('*');

    const installmentLines = installments.map(inst => ({
      plan_id: plan.id,
      due_date: inst.dueDate,
      amount: inst.amount,
      paid_amount: 0.00,
      remaining_amount: inst.amount,
      status: 'UNPAID'
    }));

    const instQuery = db('payment_plan_installments');
    if (trx) instQuery.transacting(trx);
    await instQuery.insert(installmentLines);

    return plan;
  }

  static async getPaymentPlans(companyId, entityType, entityId, trx) {
    const query = db('payment_plans')
      .where({ company_id: companyId, entity_type: entityType, entity_id: entityId })
      .orderBy('created_at', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async getPaymentPlanInstallments(planId, trx) {
    const query = db('payment_plan_installments')
      .where({ plan_id: planId })
      .orderBy('due_date', 'asc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async payInstallment(installmentId, amount, trx) {
    const instQuery = db('payment_plan_installments').where({ id: installmentId });
    if (trx) instQuery.transacting(trx);

    const inst = await instQuery.first();
    if (!inst) throw new Error('Installment not found.');

    const newPaid = parseFloat(inst.paid_amount || 0) + parseFloat(amount);
    const newRemaining = Math.max(0, parseFloat(inst.amount) - newPaid);
    const newStatus = newRemaining === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

    const updateQuery = db('payment_plan_installments').where({ id: installmentId });
    if (trx) updateQuery.transacting(trx);
    
    await updateQuery.update({
      paid_amount: newPaid,
      remaining_amount: newRemaining,
      status: newStatus,
      paid_at: newRemaining === 0 ? db.fn.now() : null,
      updated_at: db.fn.now()
    });

    // Check if the plan is now fully completed
    const siblingQuery = db('payment_plan_installments').where({ plan_id: inst.plan_id });
    if (trx) siblingQuery.transacting(trx);
    const siblings = await siblingQuery;
    const allPaid = siblings.every(s => s.status === 'PAID');

    if (allPaid) {
      const planUpdateQuery = db('payment_plans').where({ id: inst.plan_id });
      if (trx) planUpdateQuery.transacting(trx);
      await planUpdateQuery.update({ status: 'COMPLETED', updated_at: db.fn.now() });
    }
  }

  static async addHistory(companyId, entityType, entityId, action, performedBy, remarks, trx) {
    const query = db('business_relationship_history');
    if (trx) query.transacting(trx);

    const statusQuery = db('business_relationship_status')
      .where({ company_id: companyId, entity_type: entityType, entity_id: entityId });
    if (trx) statusQuery.transacting(trx);
    const statusRecord = await statusQuery.first();
    const currentScore = statusRecord ? statusRecord.risk_score : 0;

    await query.insert({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      performed_by: performedBy,
      remarks,
      risk_score: currentScore
    });
  }

  static async getHistory(companyId, entityType, entityId, trx) {
    const query = db('business_relationship_history as h')
      .leftJoin('users as u', 'h.performed_by', 'u.id')
      .where({ 'h.company_id': companyId, 'h.entity_type': entityType, 'h.entity_id': entityId })
      .select('h.*', 'u.name as performer_name')
      .orderBy('h.created_at', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async insertApprovalRequest(request, trx) {
    const query = db('risk_approval_requests');
    if (trx) query.transacting(trx);
    const [inserted] = await query.insert(request).returning('*');
    return inserted;
  }

  static async getApprovalRequestById(id, companyId, trx) {
    const query = db('risk_approval_requests').where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    return query.first();
  }

  static async updateApprovalRequest(id, companyId, data, trx) {
    const query = db('risk_approval_requests').where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    const [updated] = await query.update(data).returning('*');
    return updated;
  }

  static async getPendingApprovalRequests(companyId, trx) {
    const query = db('risk_approval_requests as r')
      .leftJoin('users as u', 'r.requested_by', 'u.id')
      .where({ 'r.company_id': companyId, 'r.status': 'PENDING' })
      .select('r.*', 'u.name as requester_name')
      .orderBy('r.created_at', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async getApprovalRequestsReport(companyId, trx) {
    const query = db('risk_approval_requests as r')
      .leftJoin('users as req', 'r.requested_by', 'req.id')
      .leftJoin('users as app', 'r.approved_by', 'app.id')
      .where({ 'r.company_id': companyId })
      .select('r.*', 'req.name as requester_name', 'app.name as approver_name')
      .orderBy('r.created_at', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async getRiskRules(companyId, trx) {
    const query = db('company_risk_rules as cr')
      .join('risk_categories as rc', 'cr.category_id', 'rc.id')
      .where('cr.company_id', companyId)
      .select('cr.*', 'rc.code', 'rc.label', 'rc.entity_scope', 'rc.severity', 'rc.rule_type', 'rc.description')
      .orderBy('rc.label', 'asc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async getRiskLevels(companyId, trx) {
    const query = db('risk_level_rules')
      .where('company_id', companyId)
      .orderBy('min_score', 'asc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async updateRiskRule(id, companyId, data, trx) {
    const query = db('company_risk_rules').where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    const [updated] = await query.update({
      weight: data.weight,
      enabled: data.enabled !== undefined ? data.enabled : true,
      updated_by: data.updatedBy,
      updated_at: db.fn.now()
    }).returning('*');
    return updated;
  }

  static async updateRiskLevel(id, companyId, data, trx) {
    const query = db('risk_level_rules').where({ id, company_id: companyId });
    if (trx) query.transacting(trx);
    const [updated] = await query.update({
      min_score: data.min_score,
      max_score: data.max_score
    }).returning('*');
    return updated;
  }

  static async addPolicyHistory(companyId, type, ruleId, oldVal, newVal, userId, reason, trx) {
    const query = db('risk_policy_history');
    if (trx) query.transacting(trx);
    await query.insert({
      company_id: companyId,
      policy_type: type,
      rule_id: ruleId,
      old_value: String(oldVal),
      new_value: String(newVal),
      changed_by: userId,
      reason
    });
  }

  static async getPolicyHistory(companyId, trx) {
    const query = db('risk_policy_history as h')
      .leftJoin('users as u', 'h.changed_by', 'u.id')
      .where('h.company_id', companyId)
      .select('h.*', 'u.name as user_name')
      .orderBy('h.created_at', 'desc');
    if (trx) query.transacting(trx);
    return query;
  }

  static async initializeCompanyRules(companyId, trx) {
    const conn = trx || db;
    const existingRules = await conn('company_risk_rules').where({ company_id: companyId }).first();
    if (existingRules) return;

    const categories = await conn('risk_categories').select('*');
    const rulesToInsert = categories.map(cat => ({
      company_id: companyId,
      category_id: cat.id,
      weight: cat.default_weight,
      enabled: true
    }));
    if (rulesToInsert.length > 0) {
      await conn('company_risk_rules').insert(rulesToInsert);
    }

    const thresholds = [
      { company_id: companyId, risk_level: 'LOW', min_score: 0, max_score: 20 },
      { company_id: companyId, risk_level: 'MEDIUM', min_score: 21, max_score: 50 },
      { company_id: companyId, risk_level: 'HIGH', min_score: 51, max_score: 80 },
      { company_id: companyId, risk_level: 'CRITICAL', min_score: 81, max_score: 999 }
    ];
    await conn('risk_level_rules').insert(thresholds);
  }
}

module.exports = RiskModel;
