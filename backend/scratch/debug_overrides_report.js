const db = require('../src/config/db');

async function run() {
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
      .where('wi.company_id', 1)
      .andWhere('wh.stage_name', 'CFO Budget Override Approval')
      .orderBy('wh.created_at', 'desc');

    console.log('Success:', overrides.length);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
