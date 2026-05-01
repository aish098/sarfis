const CompanyModel = require('../models/company.model');
const AccountModel = require('../models/account.model');
const db = require('../config/db');
const { coa_data } = require('../../seed_coa');

/**
 * Creates a new company and links the requesting user as Company Admin
 */
exports.createCompany = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  try {
    if (!name) return res.status(400).json({ message: 'Company name is required' });

    const company = await db.transaction(async (trx) => {
      const newCompany = await CompanyModel.create({
        name,
        ownerId: userId
      }, trx);

      // Link current user as Admin
      await CompanyModel.addUser(newCompany.id, userId, 'Company Admin', trx);

      // Auto-seed default Chart of Accounts
      await AccountModel.seedCoa(newCompany.id, coa_data, trx);

      return newCompany;
    });

    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Gets all companies the authenticated user belongs to
 */
exports.getCompanies = async (req, res) => {
  const userId = req.user.id;
  try {
    const companies = await CompanyModel.getByUser(userId);
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
