const companyService = require('../services/companyService');

exports.getAllCompanies = async (req, res, next) => {
  try {
    const result = await companyService.getAllCompanies(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getCompanyById = async (req, res, next) => {
  try {
    const { company_id } = req.params;
    const company = await companyService.getCompanyById(company_id);
    return res.status(200).json({
      success: true,
      data: company
    });
  } catch (err) {
    next(err);
  }
};
