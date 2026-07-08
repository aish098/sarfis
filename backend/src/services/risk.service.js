const db = require('../config/db');
const RiskModel = require('../models/risk.model');
const clientModel = require('../models/distribution.model');
const vendorModel = require('../models/vendor.model');

class RiskService {
  /**
   * Recalculates risk score based on active incidents
   */
  static async calculateRiskScore(companyId, entityType, entityId, trx) {
    const execute = async (t) => {
      const incidents = await RiskModel.getIncidents(companyId, entityType, entityId, t);
      // Filter only unresolved incidents or sum all history? Overdue incidents usually drive current score.
      // User says: "derive it from incidents or recalculate it whenever incidents change"
      // Let's sum weights of all active (unresolved) incidents for the entity.
      const activeIncidents = incidents.filter(inc => !inc.resolved);

      let score = 0;
      for (const inc of activeIncidents) {
        const cat = String(inc.category).toUpperCase();
        if (entityType === 'CUSTOMER') {
          if (cat === 'LATE_PAYMENT') score += 15;
          else if (cat === 'BOUNCED_CHEQUE') score += 40;
          else if (cat === 'OVERDUE_INVOICE') score += 30;
          else if (cat === 'BAD_DEBT') score += 60;
          else if (cat === 'LEGAL_CASE') score += 100;
          else score += 10;
        } else { // VENDOR
          if (cat === 'POOR_QUALITY') score += 20;
          else if (cat === 'LATE_DELIVERY') score += 20;
          else if (cat === 'PRICE_MANIPULATION') score += 80;
          else if (cat === 'FRAUD') score += 80;
          else if (cat === 'CONTRACT_VIOLATION') score += 50;
          else score += 10;
        }
      }

      // Cap score at 100
      score = Math.min(100, score);

      // Determine Risk Level
      let level = 'LOW';
      if (score > 80) level = 'CRITICAL';
      else if (score > 50) level = 'HIGH';
      else if (score > 20) level = 'MEDIUM';

      // Load current relationship status record
      const current = await RiskModel.getOrCreateStatus(companyId, entityType, entityId, t);
      
      const updateData = {
        risk_score: score,
        risk_level: level
      };

      // Auto Credit Policy rules (only override if status is not manually BLACKLISTED or Watchlist)
      // When score reduces or increases, we auto-update credit/restrictions:
      if (level === 'CRITICAL' || current.status === 'BLACKLISTED') {
        updateData.cash_only = true;
        updateData.manager_approval_required = true;
      } else if (level === 'HIGH') {
        updateData.credit_limit_override = 1000.00; // Cap credit limit at 1000 PKR
        updateData.manager_approval_required = true;
        updateData.cash_only = false;
        updateData.max_credit_days = 15;
      } else if (level === 'MEDIUM') {
        updateData.credit_limit_override = null; // Revert override
        updateData.max_credit_days = 30; // Max 30 days
        updateData.manager_approval_required = false;
        updateData.cash_only = false;
      } else { // LOW
        updateData.credit_limit_override = null;
        updateData.cash_only = false;
        updateData.manager_approval_required = false;
        updateData.max_credit_days = null;
      }

      // If entity has active incidents but status is normal, let's upgrade status to WATCHLIST or RESTRICTED automatically
      if (current.status === 'ACTIVE' || current.status === 'REINSTATED') {
        if (level === 'CRITICAL') {
          updateData.status = 'RESTRICTED'; // Auto-restrict if critical but not blacklisted
        } else if (level === 'HIGH' || level === 'MEDIUM') {
          updateData.status = 'WATCHLIST';
        } else {
          updateData.status = current.status; // Keep active / reinstated
        }
      }

      await RiskModel.updateStatus(companyId, entityType, entityId, updateData, t);
      return { score, level };
    };

    return trx ? execute(trx) : db.transaction(execute);
  }

  /**
   * Logs an incident and triggers risk scoring
   */
  static async logIncident(companyId, entityType, entityId, incidentData, userId) {
    return db.transaction(async (trx) => {
      const incident = {
        company_id: companyId,
        entity_type: entityType,
        entity_id: entityId,
        category: incidentData.category,
        incident_date: incidentData.incidentDate || new Date(),
        reason: incidentData.reason,
        loss_amount: parseFloat(incidentData.lossAmount || 0),
        recovered_amount: parseFloat(incidentData.recoveredAmount || 0),
        days_late: parseInt(incidentData.daysLate || 0),
        resolved: !!incidentData.resolved,
        created_by: userId,
        notes: incidentData.notes
      };

      if (incident.resolved) {
        incident.resolved_at = db.fn.now();
      }

      const inserted = await RiskModel.insertIncident(incident, trx);
      
      // Recalculate Risk Score
      const risk = await this.calculateRiskScore(companyId, entityType, entityId, trx);

      // Audit log
      const label = entityType === 'CUSTOMER' ? 'Customer' : 'Vendor';
      await RiskModel.addHistory(
        companyId,
        entityType,
        entityId,
        'INCIDENT_ADDED',
        userId,
        `Logged ${incident.category} incident with loss of PKR ${incident.loss_amount.toLocaleString()}. Current Score: ${risk.score} (${risk.level})`,
        trx
      );

      return { incident: inserted, risk };
    });
  }

  /**
   * Resolves an incident
   */
  static async resolveIncident(companyId, incidentId, resolutionData, userId) {
    return db.transaction(async (trx) => {
      const incident = await RiskModel.getIncidentById(incidentId, companyId, trx);
      if (!incident) throw new Error('Incident not found.');

      const update = {
        resolved: true,
        resolved_at: db.fn.now(),
        recovered_amount: parseFloat(resolutionData.recoveredAmount || incident.loss_amount),
        notes: resolutionData.notes || 'Incident resolved.'
      };

      await RiskModel.updateIncident(incidentId, companyId, update, trx);

      // Recalculate Risk Score
      const risk = await this.calculateRiskScore(companyId, incident.entity_type, incident.entity_id, trx);

      await RiskModel.addHistory(
        companyId,
        incident.entity_type,
        incident.entity_id,
        'INCIDENT_RESOLVED',
        userId,
        `Resolved incident ID #${incidentId}. Recovered PKR ${update.recovered_amount.toLocaleString()}. Current Score: ${risk.score} (${risk.level})`,
        trx
      );

      return { success: true, risk };
    });
  }

  /**
   * Blacklists a customer or vendor
   */
  static async blacklistEntity(companyId, entityType, entityId, data, userId) {
    return db.transaction(async (trx) => {
      const updateData = {
        status: 'BLACKLISTED',
        blacklist_expires_at: data.untilDate ? new Date(data.untilDate) : null,
        notes: data.notes || 'Blacklisted by management'
      };

      await RiskModel.updateStatus(companyId, entityType, entityId, updateData, trx);

      await RiskModel.addHistory(
        companyId,
        entityType,
        entityId,
        'BLACKLISTED',
        userId,
        `Relationship blacklisted. Expiry: ${data.untilDate || 'Permanent'}. Reason: ${data.reason}`,
        trx
      );

      // Trigger recalculation to apply correct flags
      await this.calculateRiskScore(companyId, entityType, entityId, trx);

      return { success: true };
    });
  }

  /**
   * Places entity on warning/watchlist manually
   */
  static async warnEntity(companyId, entityType, entityId, data, userId) {
    return db.transaction(async (trx) => {
      const updateData = {
        status: 'WATCHLIST',
        notes: data.notes || 'Placed on watchlist'
      };

      await RiskModel.updateStatus(companyId, entityType, entityId, updateData, trx);

      await RiskModel.addHistory(
        companyId,
        entityType,
        entityId,
        'WATCHLIST',
        userId,
        `Relationship status set to WATCHLIST. Reason: ${data.reason}`,
        trx
      );

      return { success: true };
    });
  }

  /**
   * Submits a reinstatement request
   */
  static async requestReinstatement(companyId, entityType, entityId, data, userId) {
    return db.transaction(async (trx) => {
      const statusRecord = await RiskModel.getOrCreateStatus(companyId, entityType, entityId, trx);
      if (statusRecord.status !== 'BLACKLISTED' && statusRecord.status !== 'RESTRICTED') {
        throw new Error('Only blacklisted or restricted accounts require reinstatement.');
      }

      const request = {
        company_id: companyId,
        entity_type: entityType,
        entity_id: entityId,
        reason: data.reason,
        status: 'PENDING'
      };

      const inserted = await RiskModel.insertReinstatementRequest(request, trx);

      await RiskModel.addHistory(
        companyId,
        entityType,
        entityId,
        'REINSTATEMENT_REQUESTED',
        userId,
        `Submitted request for reinstatement. Reason: ${data.reason}`,
        trx
      );

      return inserted;
    });
  }

  /**
   * Approves or rejects reinstatement
   */
  static async reviewReinstatement(companyId, requestId, reviewData, userId) {
    const PostingEngineService = require('./posting_engine.service');

    return db.transaction(async (trx) => {
      const request = await RiskModel.getReinstatementRequestById(requestId, companyId, trx);
      if (!request) throw new Error('Reinstatement request not found.');
      if (request.status !== 'PENDING') throw new Error('Request has already been reviewed.');

      const isApproved = reviewData.status === 'APPROVED';

      const updateData = {
        status: reviewData.status,
        reviewed_by: userId,
        review_notes: reviewData.reviewNotes,
        decision_date: new Date(),
        priority_after_reinstate: reviewData.priorityAfterReinstate || 'MEDIUM',
        receivables_handling: reviewData.receivablesHandling || 'KEEP_AR',
        committee_meeting_date: reviewData.committeeMeetingDate ? new Date(reviewData.committeeMeetingDate) : null,
        committee_participants: reviewData.committeeParticipants,
        committee_decision: reviewData.committeeDecision,
        committee_next_review_date: reviewData.committeeNextReviewDate ? new Date(reviewData.committeeNextReviewDate) : null
      };

      await RiskModel.updateReinstatementRequest(requestId, companyId, updateData, trx);

      if (isApproved) {
        // 1. Update relationship status to REINSTATED
        const targetPriority = reviewData.priorityAfterReinstate || 'MEDIUM';
        const statusUpdate = {
          status: 'REINSTATED',
          risk_level: targetPriority,
          blacklist_expires_at: null,
          credit_limit_override: targetPriority === 'HIGH' ? 1000.00 : null,
          cash_only: targetPriority === 'CRITICAL',
          manager_approval_required: ['HIGH', 'CRITICAL'].includes(targetPriority)
        };
        await RiskModel.updateStatus(companyId, request.entity_type, request.entity_id, statusUpdate, trx);

        // 2. Handle outstanding balance dynamically
        if (request.entity_type === 'CUSTOMER') {
          const client = await clientModel.getClientById(request.entity_id, companyId);
          const outstanding = parseFloat(client.current_balance || 0);

          if (outstanding > 0) {
            if (reviewData.receivablesHandling === 'WRITE_OFF') {
              // Post bad debt write-off entry through posting engine
              // This is dynamic, using client mappings instead of hardcoded account codes
              await PostingEngineService.postTransaction({
                type: 'BAD_DEBT_WRITE_OFF',
                companyId,
                payload: {
                  clientId: request.entity_id,
                  amount: outstanding,
                  notes: `Write-off upon Reinstatement request #${requestId}: ${reviewData.reviewNotes}`
                },
                userId,
                voucherId: null
              }, trx);
            } 
            else if (reviewData.receivablesHandling === 'SETTLEMENT') {
              // Generate payment plan installments
              const installmentsCount = parseInt(reviewData.settlementInstallmentsCount || 3);
              const frequency = reviewData.settlementFrequency || 'MONTHLY';
              const installments = [];
              const amtPerInstallment = Math.round((outstanding / installmentsCount) * 100) / 100;
              
              let current = new Date();
              for (let i = 1; i <= installmentsCount; i++) {
                if (frequency === 'WEEKLY') {
                  current.setDate(current.getDate() + 7);
                } else {
                  current.setMonth(current.getMonth() + 1);
                }
                installments.push({
                  dueDate: current.toISOString().split('T')[0],
                  amount: i === installmentsCount ? (outstanding - (amtPerInstallment * (installmentsCount - 1))) : amtPerInstallment
                });
              }

              await RiskModel.createPaymentPlan(companyId, 'CUSTOMER', request.entity_id, outstanding, frequency, userId, installments, trx);
            }
          }
        }

        await RiskModel.addHistory(
          companyId,
          request.entity_type,
          request.entity_id,
          'REINSTATED',
          userId,
          `Relationship reinstated (Priority: ${targetPriority}, Receivables: ${reviewData.receivablesHandling}). Committee decision: ${reviewData.committeeDecision || 'None'}`,
          trx
        );
      } else {
        await RiskModel.addHistory(
          companyId,
          request.entity_type,
          request.entity_id,
          'REINSTATEMENT_REJECTED',
          userId,
          `Reinstatement request rejected. Notes: ${reviewData.reviewNotes}`,
          trx
        );
      }

      return { success: true };
    });
  }

  /**
   * Refactored validation architecture (separation of concerns)
   * Pure transaction validation: returns allowed flag, code, and validation reason.
   * Does NOT perform write-offs or post journals.
   */
  static async validateTransaction(companyId, type, payload, trx = db) {
    let entityType = null;
    let entityId = null;

    if (['PURCHASE', 'PAYMENT'].includes(type.toUpperCase())) {
      entityType = 'VENDOR';
      entityId = payload.vendorId;
    } else if (['SALES', 'RECEIPT'].includes(type.toUpperCase())) {
      entityType = 'CUSTOMER';
      entityId = payload.clientId;
    }

    if (!entityType || !entityId) {
      return { allowed: true };
    }

    // 1. Check if there is an approved override request for this specific transaction/voucher
    const voucherId = payload.voucherId || null;
    if (voucherId) {
      const activeOverride = await trx('risk_approval_requests')
        .where({
          company_id: companyId,
          entity_type: entityType,
          entity_id: entityId,
          status: 'APPROVED',
          voucher_id: voucherId
        })
        .where('expires_at', '>', new Date())
        .first();

      if (activeOverride) {
        return { allowed: true }; // Bypasses subsequent blacklist / cash / limit restrictions
      }
    }

    const statusRecord = await trx('business_relationship_status')
      .where({ company_id: companyId, entity_type: entityType, entity_id: entityId })
      .first();

    if (!statusRecord) {
      return { allowed: true };
    }

    // Blacklist validation
    if (statusRecord.status === 'BLACKLISTED') {
      return {
        allowed: false,
        code: 'BLACKLISTED',
        message: `Transaction Blocked: This ${entityType === 'CUSTOMER' ? 'customer' : 'supplier'} is currently blacklisted due to bad debts / credit risk. Manager approval override required.`
      };
    }

    // Cash-only enforcement
    if (statusRecord.cash_only && !['RECEIPT', 'PAYMENT'].includes(type.toUpperCase())) {
      if (type.toUpperCase() === 'SALES' && !payload.cashAccountId) {
        return {
          allowed: false,
          code: 'CASH_ONLY',
          message: 'Transaction Blocked: Cash-only restriction is active. Credit terms are disabled.'
        };
      }
      if (type.toUpperCase() === 'PURCHASE' && !payload.cashAccountId) {
        return {
          allowed: false,
          code: 'CASH_ONLY',
          message: 'Transaction Blocked: Cash-only restriction is active. Credit terms are disabled.'
        };
      }
    }

    // Credit limit override enforcement
    if (statusRecord.credit_limit_override && type.toUpperCase() === 'SALES') {
      const client = await clientModel.getClientById(entityId, companyId);
      if (client) {
        const outstanding = parseFloat(client.current_balance || 0);
        const currentTotal = parseFloat(payload.totalAmount || payload.amount || 0);
        const limit = parseFloat(statusRecord.credit_limit_override);
        
        if (outstanding + currentTotal > limit) {
          const voucherId = payload.voucherId || null;
          let override = null;
          if (voucherId) {
            override = await trx('risk_approval_requests')
              .where({
                company_id: companyId,
                entity_type: entityType,
                entity_id: entityId,
                request_type: 'CREDIT_POLICY_CHANGE',
                status: 'APPROVED',
                voucher_id: voucherId
              })
              .where('expires_at', '>', new Date())
              .first();
          }

          if (!override) {
            return {
              allowed: false,
              code: 'CREDIT_LIMIT',
              message: `Transaction Blocked: Credit limit exceeded. Limit: PKR ${limit.toLocaleString()}, Current Balance + Order: PKR ${(outstanding + currentTotal).toLocaleString()}. Requires Manager Override.`
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Submits a pending override approval request
   */
  static async submitApprovalRequest(companyId, entityType, entityId, data, userId) {
    return db.transaction(async (trx) => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Approval valid for 24 hours

      const request = {
        company_id: companyId,
        entity_type: entityType,
        entity_id: entityId,
        request_type: data.requestType || 'TRANSACTION_OVERRIDE',
        voucher_id: data.voucherId || null,
        expires_at: expiresAt,
        reason: data.reason,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        status: 'PENDING',
        requested_by: userId
      };

      const inserted = await RiskModel.insertApprovalRequest(request, trx);

      const NotificationService = require('./notification.service');
      const requester = await db('users').where({ id: userId }).first();
      const requesterName = requester ? requester.name : 'An employee';

      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'risk.approve',
        title: 'Override Approval Required',
        message: `${requesterName} requested credit risk override for client/vendor: ${data.entityName || 'Partner'} due to: "${data.reason}".`,
        type: 'risk',
        priority: 'HIGH',
        entityType,
        entityId
      });

      await RiskModel.addHistory(
        companyId,
        entityType,
        entityId,
        'OVERRIDE_REQUESTED',
        userId,
        `Submitted override request #${inserted.id} (Type: ${data.requestType}, Reason: ${data.reason})`,
        trx
      );

      return inserted;
    });
  }

  /**
   * Approves or Rejects override requests using manager's active login session
   */
  static async reviewApprovalRequest(companyId, requestId, reviewData, userId) {
    return db.transaction(async (trx) => {
      const request = await RiskModel.getApprovalRequestById(requestId, companyId, trx);
      if (!request) throw new Error('Override request not found.');
      if (request.status !== 'PENDING') throw new Error('Request has already been reviewed.');

      const isApproved = reviewData.status === 'APPROVED';

      const updateData = {
        status: reviewData.status,
        approved_by: isApproved ? userId : null,
        approved_at: isApproved ? new Date() : null,
        review_notes: reviewData.reviewNotes,
        updated_at: db.fn.now()
      };

      await RiskModel.updateApprovalRequest(requestId, companyId, updateData, trx);

      const NotificationService = require('./notification.service');
      const reviewer = await db('users').where({ id: userId }).first();
      const reviewerName = reviewer ? reviewer.name : 'Supervisor';

      await NotificationService.createNotification({
        companyId,
        userId: request.requested_by,
        title: `Override Request ${reviewData.status}`,
        message: `Your override request was ${reviewData.status.toLowerCase()} by ${reviewerName}. Remarks: "${reviewData.reviewNotes}"`,
        type: 'risk',
        priority: isApproved ? 'MEDIUM' : 'HIGH'
      });

      await RiskModel.addHistory(
        companyId,
        request.entity_type,
        request.entity_id,
        isApproved ? 'OVERRIDE_GRANTED' : 'OVERRIDE_REJECTED',
        userId,
        `Override request #${requestId} was ${reviewData.status} (Notes: ${reviewData.reviewNotes})`,
        trx
      );

      return { success: true };
    });
  }

  /**
   * Scheduled reviews task
   */
  static async runScheduledReviews(companyId) {
    const today = new Date().toISOString().split('T')[0];
    const NotificationService = require('./notification.service');

    // 1. Notify Finance Manager on expired blacklists instead of auto-demoting
    const expiredBlacklists = await db('business_relationship_status')
      .where({ company_id: companyId, status: 'BLACKLISTED' })
      .where('blacklist_expires_at', '<', new Date());

    for (let b of expiredBlacklists) {
      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'risk.approve',
        title: 'Blacklist Review Due',
        message: `Blacklist review period is due for partner ID #${b.entity_id} (${b.entity_type}). Reassessment decision required.`,
        type: 'risk',
        priority: 'MEDIUM',
        entityType: b.entity_type,
        entityId: b.entity_id
      });
    }

    // 2. Mark expired approvals as EXPIRED
    await db('risk_approval_requests')
      .where({ company_id: companyId, status: 'APPROVED' })
      .where('expires_at', '<', new Date())
      .update({ status: 'REJECTED', review_notes: 'Automatically expired by system scheduler.' });

    // 3. Detect overdue payment plan installments
    const overdueInstallments = await db('payment_plan_installments as i')
      .join('payment_plans as p', 'i.plan_id', 'p.id')
      .where('p.company_id', companyId)
      .where('p.status', 'ACTIVE')
      .where('i.status', 'UNPAID')
      .where('i.due_date', '<', today)
      .select('i.*', 'p.entity_type', 'p.entity_id');

    for (let inst of overdueInstallments) {
      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'risk.manage',
        title: 'Settlement Installment Overdue',
        message: `Installment of PKR ${parseFloat(inst.amount).toLocaleString()} is OVERDUE since ${new Date(inst.due_date).toLocaleDateString()} for partner ID #${inst.entity_id}.`,
        type: 'risk',
        priority: 'HIGH',
        entityType: inst.entity_type,
        entityId: inst.entity_id
      });
    }
  }
}

module.exports = RiskService;
