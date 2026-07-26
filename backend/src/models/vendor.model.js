const db = require('../config/db');

class VendorModel {
  static async create(vendorData, trx) {
    const query = db('vendors');
    if (trx) query.transacting(trx);

    const res = await query
      .insert({
        company_id: vendorData.companyId,
        name: vendorData.name,
        email: vendorData.email,
        phone: vendorData.phone,
        address: vendorData.address,
        current_balance: 0.00,
        is_active: vendorData.isActive !== undefined ? vendorData.isActive : true
      })
      .returning('*');

    if (Array.isArray(res) && res.length > 0) {
      if (typeof res[0] === 'object' && res[0] !== null) return res[0];
      const insertedId = typeof res[0] === 'number' ? res[0] : (res[0]?.id);
      if (insertedId) return this.getById(insertedId, vendorData.companyId);
    }
    return db('vendors').where({ company_id: vendorData.companyId, name: vendorData.name }).orderBy('id', 'desc').first();
  }

  static async getByCompany(companyId) {
    return db('vendors')
      .where({ company_id: companyId, deleted_at: null })
      .orderBy('name', 'asc');
  }

  static async getById(id, companyId) {
    return db('vendors')
      .where({ id, company_id: companyId, deleted_at: null })
      .first();
  }

  static async update(id, companyId, vendorData, trx) {
    const query = db('vendors').where({ id, company_id: companyId, deleted_at: null });
    if (trx) query.transacting(trx);

    const [vendor] = await query
      .update({
        name: vendorData.name,
        email: vendorData.email,
        phone: vendorData.phone,
        address: vendorData.address,
        is_active: vendorData.isActive !== undefined ? vendorData.isActive : true,
        updated_at: db.fn.now()
      })
      .returning('*');
    return vendor;
  }

  static async delete(id, companyId, trx) {
    const query = db('vendors').where({ id, company_id: companyId });
    if (trx) query.transacting(trx);

    // Soft delete vendor
    const [vendor] = await query
      .update({
        deleted_at: db.fn.now(),
        is_active: false
      })
      .returning('*');
    return vendor;
  }

  static async updateBalance(id, companyId, amountDelta, trx) {
    const queryExecutor = trx || db;
    const vendor = await queryExecutor('vendors').where({ id, company_id: companyId }).first();
    if (!vendor) return;

    const current = isNaN(parseFloat(vendor.current_balance)) ? 0 : parseFloat(vendor.current_balance);
    const delta = isNaN(parseFloat(amountDelta)) ? 0 : parseFloat(amountDelta);
    const nextVal = (current + delta).toFixed(2);

    await queryExecutor('vendors')
      .where({ id, company_id: companyId })
      .update({ current_balance: nextVal });
  }
}

module.exports = VendorModel;
