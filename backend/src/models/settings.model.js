const db = require('../config/db');

class SettingsModel {
  static async getSettings(companyId) {
    const row = await db('settings')
      .where({ scope: 'company', target_id: String(companyId) })
      .first();
    
    return row ? row.value : {};
  }

  static async upsertSettings(companyId, value) {
    // 1. Sync to company_accounting_settings if accounting keys are present
    const hasAccountingKeys = [
      'defaultSalesAccountId', 'defaultApAccountId', 'defaultArAccountId', 
      'defaultInventoryAccountId', 'defaultCogsAccountId', 'defaultCashAccountId', 
      'defaultSalariesAccountId', 'taxRate', 'negativeBalanceStyle', 'inventoryCostingMethod'
    ].some(k => value.hasOwnProperty(k));
    
    if (hasAccountingKeys) {
      const mapping = {};
      if (value.hasOwnProperty('inventoryCostingMethod')) {
        const newMethod = value.inventoryCostingMethod;
        const currentSettings = await this.getSettings(companyId);
        const oldMethod = currentSettings.inventoryCostingMethod || 'AVERAGE';
        if (newMethod !== oldMethod) {
          const hasTransactions = await db('stock_logs as sl')
            .join('products as p', 'sl.product_id', 'p.id')
            .where('p.company_id', companyId)
            .first();
          if (hasTransactions) {
            throw new Error('Cannot change inventory costing method: company has existing inventory transactions.');
          }
        }
        mapping.inventory_costing_method = newMethod;
      }
      if (value.hasOwnProperty('defaultSalesAccountId')) mapping.default_sales_account_id = value.defaultSalesAccountId ? parseInt(value.defaultSalesAccountId, 10) : null;
      if (value.hasOwnProperty('defaultApAccountId')) mapping.default_ap_account_id = value.defaultApAccountId ? parseInt(value.defaultApAccountId, 10) : null;
      if (value.hasOwnProperty('defaultArAccountId')) mapping.default_ar_account_id = value.defaultArAccountId ? parseInt(value.defaultArAccountId, 10) : null;
      if (value.hasOwnProperty('defaultInventoryAccountId')) mapping.default_inventory_account_id = value.defaultInventoryAccountId ? parseInt(value.defaultInventoryAccountId, 10) : null;
      if (value.hasOwnProperty('defaultCogsAccountId')) mapping.default_cogs_account_id = value.defaultCogsAccountId ? parseInt(value.defaultCogsAccountId, 10) : null;
      if (value.hasOwnProperty('defaultCashAccountId')) mapping.default_cash_account_id = value.defaultCashAccountId ? parseInt(value.defaultCashAccountId, 10) : null;
      if (value.hasOwnProperty('taxRate')) mapping.tax_rate = parseFloat(value.taxRate || 0);
      if (value.hasOwnProperty('negativeBalanceStyle')) mapping.negative_balance_style = value.negativeBalanceStyle || 'minus';

      if (Object.keys(mapping).length > 0) {
        const existAcc = await db('company_accounting_settings').where({ company_id: companyId }).first();
        if (existAcc) {
          await db('company_accounting_settings').where({ company_id: companyId }).update(mapping);
        } else {
          await db('company_accounting_settings').insert({
            company_id: companyId,
            ...mapping
          });
        }
      }
    }

    const existing = await db('settings')
      .where({ scope: 'company', target_id: String(companyId) })
      .first();

    if (existing) {
      // Merge existing JSON value with the new value
      const mergedValue = { ...existing.value, ...value };
      const [updated] = await db('settings')
        .where({ id: existing.id })
        .update({
          value: mergedValue,
          updated_at: db.fn.now()
        })
        .returning('*');
      return updated.value;
    } else {
      const [inserted] = await db('settings')
        .insert({
          scope: 'company',
          target_id: String(companyId),
          value: value
        })
        .returning('*');
      return inserted.value;
    }
  }
}

module.exports = SettingsModel;
