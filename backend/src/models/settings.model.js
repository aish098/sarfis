const db = require('../config/db');

class SettingsModel {
  static async getSettings(companyId) {
    const row = await db('settings')
      .where({ scope: 'company', target_id: String(companyId) })
      .first();
    
    return row ? row.value : {};
  }

  static async upsertSettings(companyId, value) {
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
