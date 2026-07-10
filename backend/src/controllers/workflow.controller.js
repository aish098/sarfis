const db = require('../config/db');
const WorkflowEngineService = require('../services/workflow_engine.service');

// Pending approvals inbox listing
exports.getPendingApprovals = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userPerms = req.userPermissions || [];

  try {
    const today = new Date().toISOString().split('T')[0];
    const delegations = await db('workflow_delegations')
      .where({ company_id: companyId, to_user_id: userId, is_active: true })
      .andWhere('start_date', '<=', today)
      .andWhere('end_date', '>=', today);

    const effectiveRoles = [userRole];
    const effectivePermissions = [...userPerms];

    for (const del of delegations) {
      const u = await db('users').where({ id: del.from_user_id }).first();
      if (u) {
        effectiveRoles.push(u.role);
        const overrides = await db('user_permission_overrides')
          .where({ company_id: companyId, user_id: u.id, approval_status: 'APPROVED' })
          .select('permission_id');
        const permissionIds = overrides.map(o => o.permission_id);
        if (permissionIds.length > 0) {
          const perms = await db('permissions').whereIn('id', permissionIds).select('code');
          effectivePermissions.push(...perms.map(p => p.code));
        }
      }
    }

    const isSuperAdmin = userRole === 'Super Admin';

    let query = db('workflow_instance_approvals as wia')
      .join('workflow_stages as ws', 'wia.stage_id', 'ws.id')
      .join('workflow_instances as wi', 'wia.workflow_instance_id', 'wi.id')
      .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
      .leftJoin('users as u', 'wi.created_by', 'u.id')
      .select(
        'wia.id as approval_id',
        'wi.id as instance_id',
        'wi.document_id',
        'wi.created_at as submitted_at',
        'u.name as submitter_name',
        'wd.document_type_code',
        'ws.id as stage_id',
        'ws.name as stage_name',
        'ws.required_role',
        'ws.required_permission',
        'ws.approval_mode'
      )
      .where('wi.company_id', companyId)
      .andWhere('wi.status', 'PENDING')
      .andWhere('wia.status', 'PENDING');

    if (!isSuperAdmin) {
      query = query.andWhere(function() {
        this.where(function() {
          this.whereIn('ws.required_role', effectiveRoles).orWhereNull('ws.required_role');
        }).andWhere(function() {
          this.whereIn('ws.required_permission', effectivePermissions).orWhereNull('ws.required_permission');
        });
      });
    }

    const pending = await query.orderBy('wi.created_at', 'desc');

    const result = [];
    for (const p of pending) {
      let docSummary = '';
      let amount = 0;
      if (p.document_type_code === 'VOUCHER') {
        const v = await db('vouchers').where({ id: p.document_id }).first();
        try {
          const payload = typeof v?.payload === 'string' ? JSON.parse(v.payload) : v?.payload || {};
          docSummary = `${v?.type} Voucher: ${v?.voucher_number} - ${payload.description || ''}`;
        } catch {
          docSummary = `${v?.type} Voucher: ${v?.voucher_number}`;
        }
        amount = parseFloat(v?.total_amount || 0);
      } else if (p.document_type_code === 'JOURNAL') {
        const j = await db('journal_entries').where({ id: p.document_id }).first();
        const lines = await db('journal_lines').where({ entry_id: p.document_id });
        docSummary = `Journal Entry #${j?.id}: ${j?.description || 'Manual Journal'}`;
        amount = lines.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
      }
      result.push({ ...p, docSummary, amount });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reviewing step action
exports.reviewApprovalStage = async (req, res) => {
  const companyId = req.companyId;
  const { instanceId } = req.params;
  const { action, comments } = req.body;

  try {
    const outcome = await WorkflowEngineService.reviewStage(
      companyId,
      parseInt(instanceId),
      action,
      comments,
      req.user.id,
      req.user.role,
      req.userPermissions
    );
    res.json({ message: 'Workflow review action completed successfully', outcome });
  } catch (err) {
    console.error('Workflow Review Error:', err);
    res.status(400).json({ error: err.message });
  }
};

// History logs
exports.getApprovalHistory = async (req, res) => {
  const companyId = req.companyId;
  try {
    const history = await db('workflow_history as wh')
      .join('workflow_instances as wi', 'wh.workflow_instance_id', 'wi.id')
      .leftJoin('users as u', 'wh.user_id', 'u.id')
      .select('wh.*', 'u.name as actioned_name', 'wi.document_id', 'wi.document_type_code')
      .where('wi.company_id', companyId)
      .orderBy('wh.created_at', 'desc')
      .limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch definitions
exports.getWorkflowDefinitions = async (req, res) => {
  const companyId = req.companyId;
  try {
    const definitions = await db('workflow_definitions')
      .where({ company_id: companyId })
      .orderBy('document_type_code');
    
    const result = [];
    for (const def of definitions) {
      const stages = await db('workflow_stages')
        .where({ workflow_definition_id: def.id })
        .orderBy('stage_sequence');
      result.push({ ...def, stages });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create / Update definitions
exports.saveWorkflowDefinition = async (req, res) => {
  const companyId = req.companyId;
  const { documentTypeCode, name, stages } = req.body;

  try {
    const result = await db.transaction(async (trx) => {
      // 1. Create or update definition
      let [definition] = await trx('workflow_definitions')
        .where({ company_id: companyId, document_type_code: documentTypeCode })
        .returning('*');

      if (definition) {
        [definition] = await trx('workflow_definitions')
          .where({ id: definition.id })
          .update({ name, updated_at: trx.fn.now() })
          .returning('*');
      } else {
        [definition] = await trx('workflow_definitions')
          .insert({ company_id: companyId, document_type_code: documentTypeCode, name })
          .returning('*');
      }

      // 2. Clear and recreate stages
      await trx('workflow_stages').where({ workflow_definition_id: definition.id }).delete();

      if (stages && Array.isArray(stages)) {
        for (let i = 0; i < stages.length; i++) {
          const s = stages[i];
          await trx('workflow_stages').insert({
            workflow_definition_id: definition.id,
            stage_sequence: i + 1,
            name: s.name,
            required_role: s.requiredRole || null,
            required_permission: s.requiredPermission || null,
            conditions: s.conditions ? JSON.stringify(s.conditions) : null,
            timeout_hours: s.timeoutHours || null,
            escalate_role: s.escalateRole || null,
            approval_mode: s.approvalMode || 'SEQUENTIAL'
          });
        }
      }

      return definition;
    });

    res.json({ message: 'Workflow definition saved successfully', definition: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delegations
exports.getDelegations = async (req, res) => {
  const companyId = req.companyId;
  try {
    const delegations = await db('workflow_delegations as wd')
      .join('users as f', 'wd.from_user_id', 'f.id')
      .join('users as t', 'wd.to_user_id', 't.id')
      .select('wd.*', 'f.name as from_user_name', 't.name as to_user_name')
      .where({ 'wd.company_id': companyId })
      .orderBy('wd.created_at', 'desc');
    res.json(delegations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createDelegation = async (req, res) => {
  const companyId = req.companyId;
  const { toUserId, startDate, endDate } = req.body;
  const fromUserId = req.user.id;

  try {
    const [delegation] = await db('workflow_delegations')
      .insert({
        company_id: companyId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        start_date: startDate,
        end_date: endDate,
        is_active: true
      })
      .returning('*');
    res.status(201).json(delegation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.cancelDelegation = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  try {
    await db('workflow_delegations')
      .where({ id, company_id: companyId })
      .update({ is_active: false, updated_at: db.fn.now() });
    res.json({ message: 'Delegation cancelled successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Timeline view helper
exports.getInstanceTimeline = async (req, res) => {
  const companyId = req.companyId;
  const { instanceId } = req.params;
  try {
    const timeline = await db('workflow_history as wh')
      .join('workflow_instances as wi', 'wh.workflow_instance_id', 'wi.id')
      .leftJoin('users as u', 'wh.user_id', 'u.id')
      .select('wh.*', 'u.name as actioned_name')
      .where({ 'wi.id': instanceId, 'wi.company_id': companyId })
      .orderBy('wh.created_at', 'asc');
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Workflow stats
exports.getWorkflowStats = async (req, res) => {
  const companyId = req.companyId;
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Active Delegations today
    const delegationsCount = await db('workflow_delegations')
      .where({ company_id: companyId, is_active: true })
      .andWhere('start_date', '<=', today)
      .andWhere('end_date', '>=', today)
      .count('id as count')
      .first();
    const activeDelegations = parseInt(delegationsCount?.count || 0, 10);

    // 2. Processed Today (approvals actioned today in history)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const processedTodayResult = await db('workflow_history as wh')
      .join('workflow_instances as wi', 'wh.workflow_instance_id', 'wi.id')
      .where('wi.company_id', companyId)
      .andWhere('wh.created_at', '>=', todayStart)
      .countDistinct('wh.workflow_instance_id as count')
      .first();
    const processedToday = parseInt(processedTodayResult?.count || 0, 10);

    // 3. Average Approval Time (in hours, completed instances in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completed = await db('workflow_instances')
      .where({ company_id: companyId })
      .whereIn('status', ['APPROVED', 'REJECTED'])
      .andWhere('updated_at', '>=', thirtyDaysAgo)
      .select('created_at', 'updated_at');

    let averageApprovalTime = 0;
    if (completed.length > 0) {
      let totalMs = 0;
      for (const inst of completed) {
        const start = new Date(inst.created_at);
        const end = new Date(inst.updated_at);
        totalMs += (end - start);
      }
      averageApprovalTime = parseFloat((totalMs / completed.length / (1000 * 60 * 60)).toFixed(1));
    } else {
      averageApprovalTime = 1.5; // default fallback
    }

    res.json({
      activeDelegations,
      processedToday,
      averageApprovalTime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Dev route to seed a test approval entry dynamically
exports.seedTestApproval = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.user.id;
  const userRole = req.user.role;
  const WorkflowEngineService = require('../services/workflow_engine.service');

  try {
    const result = await db.transaction(async (trx) => {
      // 1. Ensure Workflow Definition for VOUCHER exists
      let def = await trx('workflow_definitions')
        .where({ company_id: companyId, document_type_code: 'VOUCHER' })
        .first();

      if (!def) {
        [def] = await trx('workflow_definitions')
          .insert({
            company_id: companyId,
            document_type_code: 'VOUCHER',
            name: 'Unified Voucher Approvals',
            is_active: true
          })
          .returning('*');
      }

      // 2. Ensure Workflow Stage exists matching the current user's role
      let stage = await trx('workflow_stages')
        .where({ workflow_definition_id: def.id, stage_sequence: 1 })
        .first();

      if (!stage) {
        [stage] = await trx('workflow_stages')
          .insert({
            workflow_definition_id: def.id,
            stage_sequence: 1,
            name: 'Manager Review Step',
            required_role: userRole || 'Admin',
            required_permission: 'approval.approve',
            timeout_hours: 24,
            approval_mode: 'SEQUENTIAL'
          })
          .returning('*');
      } else {
        // Update stage to match user's role so it routes to their inbox
        await trx('workflow_stages')
          .where({ id: stage.id })
          .update({
            required_role: userRole,
            required_permission: 'approval.approve'
          });
      }

      // 3. Ensure Vendor exists
      let vendor = await trx('vendors').where({ company_id: companyId }).first();
      if (!vendor) {
        [vendor] = await trx('vendors')
          .insert({
            company_id: companyId,
            name: 'Prime Stationery Supplies Ltd.',
            email: 'sales@primestationery.com',
            phone: '+92 300 1234567',
            address: 'Main Commercial Area, Karachi, Pakistan'
          })
          .returning('*');
      }

      // 4. Create Draft Purchase Voucher
      const payload = {
        notes: "Office Stationeries and Supplies procurement for Q3 operations.",
        vendorId: vendor.id,
        warehouseId: 1,
        items: [
          {
            description: "Premium Copier Paper Reams (A4)",
            quantity: 100,
            unitPrice: 500,
            amount: 50000
          },
          {
            description: "Executive Ergonomic Office Chairs",
            quantity: 1,
            unitPrice: 25000,
            amount: 25000
          }
        ]
      };

      const [voucher] = await trx('vouchers')
        .insert({
          company_id: companyId,
          voucher_number: `PV-UAT-${Date.now().toString().slice(-4)}`,
          type: 'PURCHASE',
          date: new Date().toISOString().split('T')[0],
          status: 'DRAFT',
          total_amount: 75000,
          payload: JSON.stringify(payload),
          created_by: userId
        })
        .returning('*');

      // 5. Submit to Workflow Engine
      await WorkflowEngineService.submitToWorkflow(
        companyId,
        'VOUCHER',
        voucher.id,
        75000,
        userId,
        trx
      );

      // Update voucher status to PENDING_APPROVAL
      await trx('vouchers')
        .where({ id: voucher.id })
        .update({
          status: 'PENDING_APPROVAL',
          updated_at: trx.fn.now()
        });

      return voucher;
    });

    res.json({
      success: true,
      message: `Successfully seeded test approval voucher ${result.voucher_number} for company ${companyId}.`,
      voucher: result
    });
  } catch (err) {
    console.error('[SEED ERROR]', err);
    res.status(500).json({ error: err.message });
  }
};
