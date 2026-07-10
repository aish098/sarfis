const db = require('../src/config/db');
const WorkflowEngineService = require('../src/services/workflow_engine.service');

async function run() {
  console.log("=========================================================");
  console.log("          CREATING PENDING APPROVAL FOR UAT              ");
  console.log("=========================================================");

  try {
    const companyId = 13;
    const userId = 14; // Bisma (Admin role in company 13)

    // 1. Core Setup: Ensure Workflow Definition for VOUCHER exists
    let def = await db('workflow_definitions').where({ company_id: companyId, document_type_code: 'VOUCHER' }).first();
    if (!def) {
      console.log("- Creating Workflow Definition for VOUCHER...");
      [def] = await db('workflow_definitions')
        .insert({
          company_id: companyId,
          document_type_code: 'VOUCHER',
          name: 'Unified Voucher Approvals',
          is_active: true
        })
        .returning('*');
    }

    // 2. Ensure Workflow Stage exists (requiring Admin role and approval.approve permission)
    let stage = await db('workflow_stages').where({ workflow_definition_id: def.id, stage_sequence: 1 }).first();
    if (!stage) {
      console.log("- Creating Workflow Stage 1 (Manager Board Review)...");
      [stage] = await db('workflow_stages')
        .insert({
          workflow_definition_id: def.id,
          stage_sequence: 1,
          name: 'Manager Board Review',
          required_role: 'Admin',
          required_permission: 'approval.approve',
          timeout_hours: 24,
          approval_mode: 'SEQUENTIAL'
        })
        .returning('*');
    }

    // 3. Ensure Vendor exists
    let vendor = await db('vendors').where({ company_id: companyId }).first();
    if (!vendor) {
      console.log("- Creating Mock Vendor...");
      [vendor] = await db('vendors')
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
    console.log("- Creating Draft Purchase Voucher...");
    const payload = {
      notes: "Office Stationeries and Supplies procurement for Q3 operations.",
      vendorId: vendor.id,
      warehouseId: 1, // default or placeholder
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

    const [voucher] = await db('vouchers')
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

    console.log(`- Created Voucher ${voucher.voucher_number} (ID: ${voucher.id}) in DRAFT state.`);

    // 5. Submit to Workflow
    console.log("- Submitting Voucher to Workflow Engine...");
    await db.transaction(async (trx) => {
      const res = await WorkflowEngineService.submitToWorkflow(
        companyId,
        'VOUCHER',
        voucher.id,
        75000,
        userId,
        trx
      );

      console.log(`- Workflow Submission status: ${res.status}, Instance ID: ${res.instanceId}`);

      await trx('vouchers')
        .where({ id: voucher.id })
        .update({
          status: 'PENDING_APPROVAL',
          updated_at: trx.fn.now()
        });
    });

    console.log("\nSuccess! A new pending approval has been created. Refresh your inbox page on the website to view and test it!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating UAT approval:", err);
    process.exit(1);
  }
}

run();
