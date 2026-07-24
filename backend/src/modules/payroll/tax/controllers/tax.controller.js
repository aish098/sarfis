const TaxService = require('../services/tax.service');

exports.getTaxYears = async (req, res) => {
  try {
    const years = await TaxService.getTaxYears();
    res.json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTaxSlabs = async (req, res) => {
  try {
    const taxYearId = req.query.taxYearId || req.params.yearId;
    let yearId = taxYearId;

    if (!yearId) {
      const years = await TaxService.getTaxYears();
      const active = years.find(y => y.status === 'ACTIVE') || years[0];
      if (active) yearId = active.id;
    }

    if (!yearId) {
      return res.status(404).json({ error: 'No active tax year found.' });
    }

    const slabs = await TaxService.getTaxSlabs(yearId);
    res.json({ success: true, taxYearId: yearId, data: slabs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.calculateTax = async (req, res) => {
  try {
    const { annualTaxableIncome, annual_salary, taxYearCode, taxYear } = req.body;
    const salary = annualTaxableIncome !== undefined ? annualTaxableIncome : annual_salary;
    const code = taxYearCode || taxYear || 'PK-2026-27-SALARY';

    if (salary === undefined || salary === null) {
      return res.status(400).json({ error: 'annualTaxableIncome or annual_salary is required.' });
    }

    const result = await TaxService.calculateAnnualTax({
      annualTaxableIncome: salary,
      taxYearCode: code
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.calculateWithholding = async (req, res) => {
  try {
    const { annualTaxableIncome, taxAlreadyWithheld, remainingPeriods, taxYearCode } = req.body;

    const result = await TaxService.calculatePayrollWithholding({
      annualTaxableIncome,
      taxAlreadyWithheld,
      remainingPeriods,
      taxYearCode
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.createTaxYear = async (req, res) => {
  try {
    const inserted = await TaxService.createTaxYear(req.body);
    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.createTaxSlab = async (req, res) => {
  try {
    const inserted = await TaxService.createTaxSlab(req.body);
    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateTaxSlab = async (req, res) => {
  try {
    const updated = await TaxService.updateTaxSlab(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteTaxSlab = async (req, res) => {
  try {
    await TaxService.deleteTaxSlab(req.params.id);
    res.json({ success: true, message: 'Tax slab deleted successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
