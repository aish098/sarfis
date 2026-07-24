const { TaxService, AppError } = require('../services/tax.service');

const handleError = (res, err) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.errorCode
    });
  }
  return res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};

exports.getTaxYears = async (req, res) => {
  try {
    const years = await TaxService.getTaxYears();
    res.json({ success: true, data: years });
  } catch (err) {
    handleError(res, err);
  }
};

exports.getTaxSlabs = async (req, res) => {
  try {
    const taxYearId = req.query.taxYearId || req.params.yearId;
    let yearId = taxYearId;

    if (!yearId) {
      const activeYear = await TaxService.resolveActiveTaxYear({
        companyId: req.user?.company_id,
        countryCode: req.query.countryCode || 'PK',
        taxCategory: req.query.taxCategory || 'SALARY'
      });
      yearId = activeYear.id;
    }

    const slabs = await TaxService.getTaxSlabs(yearId);
    res.json({ success: true, taxYearId: yearId, data: slabs });
  } catch (err) {
    handleError(res, err);
  }
};

exports.calculateTax = async (req, res) => {
  try {
    const body = req.validatedBody || req.body;
    const salary = body.annualTaxableIncome !== undefined ? body.annualTaxableIncome : body.annual_salary;

    const result = await TaxService.calculateAnnualTax({
      annualTaxableIncome: salary,
      taxYearCode: body.taxYearCode || body.taxYear,
      companyId: req.user?.company_id,
      countryCode: body.countryCode || 'PK',
      taxCategory: body.taxCategory || 'SALARY',
      calculationDate: body.calculationDate
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.calculateWithholding = async (req, res) => {
  try {
    const body = req.validatedBody || req.body;

    const result = await TaxService.calculatePayrollWithholding({
      annualTaxableIncome: body.annualTaxableIncome,
      taxAlreadyWithheld: body.taxAlreadyWithheld,
      remainingPeriods: body.remainingPeriods,
      taxYearCode: body.taxYearCode,
      companyId: req.user?.company_id,
      countryCode: body.countryCode || 'PK',
      taxCategory: body.taxCategory || 'SALARY',
      calculationDate: body.calculationDate
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(res, err);
  }
};

exports.createTaxYear = async (req, res) => {
  try {
    const inserted = await TaxService.createTaxYear(req.body);
    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    handleError(res, err);
  }
};

exports.approveTaxYear = async (req, res) => {
  try {
    const approved = await TaxService.approveTaxYear(req.params.id, req.user?.id);
    res.json({ success: true, data: approved });
  } catch (err) {
    handleError(res, err);
  }
};

exports.activateTaxYear = async (req, res) => {
  try {
    const activated = await TaxService.activateTaxYear(req.params.id, req.user?.id);
    res.json({ success: true, data: activated });
  } catch (err) {
    handleError(res, err);
  }
};

exports.archiveTaxYear = async (req, res) => {
  try {
    const archived = await TaxService.archiveTaxYear(req.params.id, req.user?.id);
    res.json({ success: true, data: archived });
  } catch (err) {
    handleError(res, err);
  }
};

exports.createTaxSlab = async (req, res) => {
  try {
    const inserted = await TaxService.createTaxSlab(req.body);
    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    handleError(res, err);
  }
};

exports.updateTaxSlab = async (req, res) => {
  try {
    const updated = await TaxService.updateTaxSlab(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    handleError(res, err);
  }
};

exports.deleteTaxSlab = async (req, res) => {
  try {
    await TaxService.deleteTaxSlab(req.params.id);
    res.json({ success: true, message: 'Tax slab deleted successfully.' });
  } catch (err) {
    handleError(res, err);
  }
};
