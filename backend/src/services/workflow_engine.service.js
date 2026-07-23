const db = require('../config/db');
const WorkflowRegistryService = require('./workflow_registry.service');
const NotificationService = require('./notification.service');

class WorkflowEngineService {
  /**
   * Evaluates if a list of conditions are met for a transaction.
   */
  static evaluateConditions(conditions, amount) {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return true;
    }

    // Default to matching all conditions (AND logic)
    for (const cond of conditions) {
      const { field, operator, value } = cond;
      if (field === 'amount') {
        const val = parseFloat(value);
        const amt = parseFloat(amount || 0);
        if (operator === '>=' && !(amt >= val)) return false;
        if (operator === '>' && !(amt > val)) return false;
        if (operator === '<=' && !(amt <= val)) return false;
        if (operator === '<' && !(amt < val)) return false;
        if (operator === '=' && !(amt === val)) return false;
      }
    }
    return true;
  }

  /**
   * Submits a document to the unified approval workflow.
   */
  static async submitToWorkflow(companyId, docTypeCode, docId, amount, userId, trx = db) {
    // 1. Check if a workflow definition exists for this company & doc type
    let def = await trx('workflow_definitions')
      .where({ company_id: companyId, document_type_code: docTypeCode, is_active: true })
      .first();

    // If no workflow definition exists, dynamically seed a standard one instead of auto-approving
    if (!def) {
      console.log(`[WORKFLOW] No active definition for ${docTypeCode} in company ${companyId}. Dynamic seeding...`);
      
      const defaultNames = {
        'PURCHASE_REQUISITION': { defName: 'Standard Purchase Requisition Approval Process', stageName: 'Department Manager Requisition Review' },
        'BUDGET': { defName: 'Standard Budget Approval Process', stageName: 'Finance Manager Budget Review' },
        'PURCHASE_ORDER': { defName: 'Standard Purchase Order Approval Process', stageName: 'Manager Purchase Review' }
      };

      const defaults = defaultNames[docTypeCode] || { 
        defName: `Standard ${docTypeCode} Approval Process`, 
        stageName: `Manager ${docTypeCode} Review` 
      };

      const [inserted] = await trx('workflow_definitions')
        .insert({
          company_id: companyId,
          document_type_code: docTypeCode,
          name: defaults.defName,
          is_active: true
        })
        .returning('*');
      
      def = inserted;

      await trx('workflow_stages').insert({
        workflow_definition_id: def.id,
        stage_sequence: 1,
        name: defaults.stageName,
        required_role: null,
        required_permission: null,
        approval_mode: 'SEQUENTIAL'
      });
    }

    // 2. Load all stages and filter them based on conditions
    const allStages = await trx('workflow_stages')
      .where({ workflow_definition_id: def.id })
      .orderBy('stage_sequence', 'asc');

    const activeStages = allStages.filter(stage => 
      this.evaluateConditions(stage.conditions, amount)
    );

    // Dynamic Budget Block Override Injection
    let budgetBlockBreach = false;
    let docLines = [];
    let docDate = new Date().toISOString().split('T')[0];
    
    try {
      const BudgetService = require('./budget.service');
      if (docTypeCode === 'JOURNAL') {
        const j = await trx('journal_entries').where({ id: docId }).first();
        if (j) {
          docDate = j.entry_date;
          const dbLines = await trx('journal_lines').where({ entry_id: docId });
          docLines = dbLines.map(l => ({ 
            accountId: l.account_id, 
            debit: l.debit, 
            credit: l.credit,
            department: l.department,
            project: l.project,
            branch: l.branch
          }));
        }
      } else if (docTypeCode === 'VOUCHER') {
        const v = await trx('vouchers').where({ id: docId }).first();
        if (v) {
          docDate = v.date || v.created_at;
          const payload = typeof v.payload === 'string' ? JSON.parse(v.payload) : v.payload || {};
          const linesData = payload.lines || [];
          docLines = linesData.map(l => ({ 
            accountId: l.accountId || l.account_id, 
            debit: l.amount || l.debit, 
            credit: 0,
            department: l.department || v.department,
            project: l.project || v.project,
            branch: l.branch || v.branch
          }));
        }
      }

      const budgetCheck = await BudgetService.checkTransactionBudget(companyId, docTypeCode, docId, docLines, trx);
      if (budgetCheck.isExceeded) {
        budgetBlockBreach = budgetCheck.breaches.some(b => b.controlLevel === 'BLOCK');
      }

      if (budgetBlockBreach) {
        console.log(`[WORKFLOW] Document ${docTypeCode} #${docId} exceeds budget. Injecting CFO Budget Override stage...`);
        let cfoStage = await trx('workflow_stages')
          .where({ workflow_definition_id: def.id, required_role: 'CFO' })
          .first();
        
        if (!cfoStage) {
          const [inserted] = await trx('workflow_stages')
            .insert({
              workflow_definition_id: def.id,
              stage_sequence: allStages.length + 1,
              name: 'CFO Budget Override Approval',
              required_role: 'CFO',
              required_permission: 'journal.post',
              conditions: null,
              timeout_hours: 24,
              approval_mode: 'SEQUENTIAL'
            })
            .returning('*');
          cfoStage = inserted;
        }
        
        // Push CFO override stage if not already active in current list
        if (!activeStages.some(s => s.id === cfoStage.id)) {
          activeStages.push(cfoStage);
        }
      }
    } catch (budgetErr) {
      console.error('[WORKFLOW BUDGET EVALUATION ERROR]', budgetErr);
    }

    // If no stages apply, auto-approve
    if (activeStages.length === 0) {
      console.log(`[WORKFLOW] No stages matched conditions for ${docTypeCode} #${docId}. Auto-approving...`);
      await WorkflowRegistryService.executeCallback(docTypeCode, docId, companyId, 'APPROVE', userId, trx);
      return { status: 'APPROVED', autoApproved: true };
    }

    // 3. Create workflow instance (calculating cycle_number)
    const lastInstance = await trx('workflow_instances')
      .where({ company_id: companyId, workflow_definition_id: def.id, document_id: docId })
      .max('cycle_number as max_cycle')
      .first();

    const nextCycleNumber = Number(lastInstance?.max_cycle || 0) + 1;

    const [instance] = await trx('workflow_instances')
      .insert({
        company_id: companyId,
        workflow_definition_id: def.id,
        document_id: docId,
        cycle_number: nextCycleNumber,
        current_stage_sequence: activeStages[0].stage_sequence,
        status: 'PENDING',
        created_by: userId
      })
      .returning('*');

    // Register COMMITTED spend reservation
    try {
      const BudgetService = require('./budget.service');
      await BudgetService.commitCommittedSpend(docTypeCode, docId, companyId, docDate, docLines, trx);
    } catch (commitErr) {
      console.error('[WORKFLOW COMMIT SPEND ERROR]', commitErr);
    }

    const firstStage = activeStages[0];

    // 4. Create pending stage approval
    await trx('workflow_instance_approvals').insert({
      workflow_instance_id: instance.id,
      stage_id: firstStage.id,
      status: 'PENDING'
    });

    // 5. Write history log
    await trx('workflow_history').insert({
      workflow_instance_id: instance.id,
      action: 'SUBMITTED',
      stage_name: 'Initialization',
      user_id: userId,
      comments: `Document submitted for approval. Amount: PKR ${amount}`
    });

    // 6. Notify the approvers
    try {
      const submitter = await trx('users').where({ id: userId }).first();
      const submitterName = submitter ? submitter.name : 'User';

      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: firstStage.required_permission || 'approval.view',
        title: `Approval Required: ${firstStage.name}`,
        message: `A new ${docTypeCode} requires your review for approval stage '${firstStage.name}' (Submitted by ${submitterName}).`,
        type: 'approval',
        priority: 'MEDIUM',
        entityType: 'approval',
        entityId: instance.id
      });
    } catch (err) {
      console.error('[WORKFLOW NOTIFICATION ERROR]', err);
    }

    return { status: 'PENDING', instanceId: instance.id };
  }

  /**
   * Reviews and processes an approval step.
   */
  static async reviewStage(companyId, instanceId, action, comments, userId, userRole, userPermissions = [], trx = db) {
    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new Error('Invalid action. Must be APPROVE or REJECT.');
    }

    const instance = await trx('workflow_instances as wi')
      .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
      .where({ 'wi.id': instanceId, 'wi.company_id': companyId })
      .select('wi.*', 'wd.document_type_code')
      .first();

    if (!instance) throw new Error('Workflow instance not found.');
    if (instance.status !== 'PENDING') throw new Error('This workflow is no longer pending.');

    // 1. Fetch active stages
    const allStages = await trx('workflow_stages')
      .where({ workflow_definition_id: instance.workflow_definition_id })
      .orderBy('stage_sequence', 'asc');

    // Re-resolve amount to evaluate active stages
    let amount = 0;
    if (instance.document_type_code === 'VOUCHER') {
      const v = await trx('vouchers').where({ id: instance.document_id }).first();
      amount = parseFloat(v?.total_amount || 0);
    } else if (instance.document_type_code === 'JOURNAL') {
      const lines = await trx('journal_lines').where({ entry_id: instance.document_id });
      amount = lines.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
    } else if (instance.document_type_code === 'PURCHASE_ORDER') {
      const po = await trx('purchase_orders').where({ id: instance.document_id }).first();
      amount = parseFloat(po?.total_amount || 0);
    } else if (instance.document_type_code === 'BUDGET') {
      const lines = await trx('budget_control_lines').where({ budget_header_id: instance.document_id });
      amount = lines.reduce((sum, l) => sum + parseFloat(l.allocated_amount || 0), 0);
    }

    const activeStages = allStages.filter(stage => 
      this.evaluateConditions(stage.conditions, amount)
    );

    const currentStageIndex = activeStages.findIndex(s => s.stage_sequence === instance.current_stage_sequence);
    if (currentStageIndex === -1) throw new Error('Current stage sequence is invalid.');
    const currentStage = activeStages[currentStageIndex];

    // 2. Delegation Check (Check if current user is delegated to approve on behalf of another)
    let effectiveUserId = userId;
    let effectiveRole = userRole;
    let effectivePermissions = [...userPermissions];

    const today = new Date().toISOString().split('T')[0];
    const delegation = await trx('workflow_delegations')
      .where({ company_id: companyId, to_user_id: userId, is_active: true })
      .andWhere('start_date', '<=', today)
      .andWhere('end_date', '>=', today)
      .first();

    if (delegation) {
      console.log(`[WORKFLOW] User ${userId} is acting as delegate for user ${delegation.from_user_id}`);
      const delegatedUser = await trx('users').where({ id: delegation.from_user_id }).first();
      if (delegatedUser) {
        effectiveUserId = delegatedUser.id;
        
        // Fetch delegated user's company specific role
        const membership = await trx('user_roles')
          .join('roles', 'user_roles.role_id', 'roles.id')
          .select('roles.name as role')
          .where('user_roles.user_id', delegation.from_user_id)
          .andWhere('user_roles.company_id', companyId)
          .first();

        effectiveRole = membership ? membership.role : delegatedUser.role;

        // Fetch delegated user's permissions
        const RoleService = require('./role.service');
        effectivePermissions = await RoleService.getUserPermissions(delegation.from_user_id, companyId, trx);
      }
    }

    // 3. Authority Validation
    const isSuperAdmin = effectiveRole === 'Super Admin';
    const matchesRole = currentStage.required_role ? effectiveRole === currentStage.required_role : true;
    const matchesPerm = currentStage.required_permission ? effectivePermissions.includes(currentStage.required_permission) : true;

    if (!isSuperAdmin && (!matchesRole || !matchesPerm)) {
      throw new Error(`Unauthorized. This stage requires role '${currentStage.required_role || 'Any'}' and permission '${currentStage.required_permission || 'None'}'.`);
    }

    // 4. Update the pending approval record
    const pendingApproval = await trx('workflow_instance_approvals')
      .where({ workflow_instance_id: instanceId, stage_id: currentStage.id, status: 'PENDING' })
      .first();

    if (pendingApproval) {
      await trx('workflow_instance_approvals')
        .where({ id: pendingApproval.id })
        .update({
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          actioned_by: userId, // Record actual user who clicked
          actioned_at: trx.fn.now(),
          comments: comments || null,
          updated_at: trx.fn.now()
        });
    }

    // Write history log
    await trx('workflow_history').insert({
      workflow_instance_id: instanceId,
      action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      stage_name: currentStage.name,
      user_id: userId,
      comments: comments || `${action}d stage: ${currentStage.name}`
    });

    // 5. Process Outcome
    if (action === 'REJECT') {
      // Instance rejected
      await trx('workflow_instances')
        .where({ id: instanceId })
        .update({ status: 'REJECTED', updated_at: trx.fn.now() });

      // Release budget spend reservation
      try {
        const BudgetService = require('./budget.service');
        await BudgetService.releaseSpend(instance.document_type_code, instance.document_id, trx);
      } catch (relErr) {
        console.error('[WORKFLOW BUDGET RELEASE ERROR]', relErr);
      }

      // Reset document back to DRAFT / REJECTED
      if (instance.document_type_code === 'VOUCHER') {
        await trx('vouchers').where({ id: instance.document_id, company_id: companyId }).update({ status: 'DRAFT' });
      } else if (instance.document_type_code === 'JOURNAL') {
        await trx('journal_entries').where({ id: instance.document_id, company_id: companyId }).update({ status: 'DRAFT' });
      } else if (instance.document_type_code === 'PURCHASE_ORDER') {
        await trx('purchase_orders').where({ id: instance.document_id, company_id: companyId }).update({ status: 'REJECTED' });
      } else if (instance.document_type_code === 'PURCHASE_REQUISITION') {
        const prService = require('./purchase_requisition.service');
        await prService.rejectPurchaseRequisition(instance.document_id, companyId, userId, 'REJECTED', comments || 'Rejected by workflow approver', trx);
      }

      // Notify the creator
      try {
        await NotificationService.notifyDirect({
          companyId,
          userIds: [instance.created_by],
          title: `Approval Rejected: ${instance.document_type_code}`,
          message: `Your ${instance.document_type_code} approval request was rejected by reviewers. Status reset to Draft. Comment: ${comments || 'No comment.'}`,
          type: 'approval',
          priority: 'HIGH',
          entityType: 'approval',
          entityId: instanceId
        });
      } catch (err) {
        console.error(err);
      }

      return { status: 'REJECTED' };
    }

    // If approved, check if there is a next stage
    const nextStage = activeStages[currentStageIndex + 1];

    if (nextStage) {
      // Advance to next stage
      await trx('workflow_instances')
        .where({ id: instanceId })
        .update({
          current_stage_sequence: nextStage.stage_sequence,
          updated_at: trx.fn.now()
        });

      // Create new pending approval
      await trx('workflow_instance_approvals').insert({
        workflow_instance_id: instanceId,
        stage_id: nextStage.id,
        status: 'PENDING'
      });

      // Notify next approvers
      try {
        const reviewer = await trx('users').where({ id: userId }).first();
        const reviewerName = reviewer ? reviewer.name : 'Approver';

        await NotificationService.notifyUsersWithPermission({
          companyId,
          permissionCode: nextStage.required_permission || 'approval.view',
          title: `Approval Required: ${nextStage.name}`,
          message: `Document approved at stage '${currentStage.name}' by ${reviewerName}. Now routing to '${nextStage.name}'.`,
          type: 'approval',
          priority: 'MEDIUM',
          entityType: 'approval',
          entityId: instanceId
        });
      } catch (err) {
        console.error(err);
      }

      return { status: 'PENDING', nextStage: nextStage.name };
    } else {
      // Final stage completed!
      await trx('workflow_instances')
        .where({ id: instanceId })
        .update({ status: 'APPROVED', updated_at: trx.fn.now() });

      // Execute callback trigger
      await WorkflowRegistryService.executeCallback(
        instance.document_type_code,
        instance.document_id,
        companyId,
        'APPROVE',
        instance.created_by,
        trx
      );

      // Notify creator
      try {
        await NotificationService.notifyDirect({
          companyId,
          userIds: [instance.created_by],
          title: `Approval Completed & Posted`,
          message: `Your ${instance.document_type_code} has passed all approval stages and is posted successfully.`,
          type: 'approval',
          priority: 'HIGH',
          entityType: 'approval',
          entityId: instanceId
        });
      } catch (err) {
        console.error(err);
      }

      return { status: 'APPROVED' };
    }
  }
}

module.exports = WorkflowEngineService;
