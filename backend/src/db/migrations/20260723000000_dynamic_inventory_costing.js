exports.up = async function up(knex) {
  // 1. Add fields to purchase_requisition_items if not present
  const hasUnitPurchasePrice = await knex.schema.hasColumn('purchase_requisition_items', 'unit_purchase_price');
  if (!hasUnitPurchasePrice) {
    await knex.schema.alterTable('purchase_requisition_items', table => {
      table.decimal('unit_purchase_price', 18, 6).nullable();
      table.string('currency_code', 3).nullable().defaultTo('PKR');
    });
  }

  // 2. Add fields to goods_receipt_items if not present
  const hasGrnUnitCost = await knex.schema.hasColumn('goods_receipt_items', 'unit_cost');
  if (!hasGrnUnitCost) {
    await knex.schema.alterTable('goods_receipt_items', table => {
      table.decimal('unit_cost', 18, 6).notNullable().defaultTo(0);
      table.decimal('received_value', 18, 2).notNullable().defaultTo(0);
    });
  }

  // 3. Create inventory_cost_balances for warehouse-isolated weighted average balances
  const hasCostBalances = await knex.schema.hasTable('inventory_cost_balances');
  if (!hasCostBalances) {
    await knex.schema.createTable('inventory_cost_balances', table => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').notNullable();
      table.bigInteger('warehouse_id').notNullable();
      table.bigInteger('product_id').notNullable();

      table.decimal('quantity_on_hand', 18, 6).notNullable().defaultTo(0);
      table.decimal('inventory_value', 18, 2).notNullable().defaultTo(0);
      table.decimal('average_unit_cost', 18, 6).notNullable().defaultTo(0);

      table.timestamps(true, true);

      table.unique(['company_id', 'warehouse_id', 'product_id'], 'uq_inventory_cost_balance');
      table.index(['company_id', 'warehouse_id', 'product_id']);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('inventory_cost_balances');
  const hasGrnUnitCost = await knex.schema.hasColumn('goods_receipt_items', 'unit_cost');
  if (hasGrnUnitCost) {
    await knex.schema.alterTable('goods_receipt_items', table => {
      table.dropColumn('unit_cost');
      table.dropColumn('received_value');
    });
  }
  const hasUnitPurchasePrice = await knex.schema.hasColumn('purchase_requisition_items', 'unit_purchase_price');
  if (hasUnitPurchasePrice) {
    await knex.schema.alterTable('purchase_requisition_items', table => {
      table.dropColumn('unit_purchase_price');
      table.dropColumn('currency_code');
    });
  }
};
