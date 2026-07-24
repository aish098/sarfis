const express = require('express');
const router = express.Router();
const taxCtrl = require('../controllers/tax.controller');
const { authMiddleware, authenticate, requirePermission } = require('../../../../middleware/auth.middleware');
const {
  validate,
  calculateSchema,
  withholdingSchema,
  createTaxYearSchema,
  createTaxSlabSchema
} = require('../validators/tax.validator');

// Tax Years Endpoints
router.get(
  '/years',
  authenticate,
  requirePermission('payroll.tax.view'),
  taxCtrl.getTaxYears
);

router.post(
  '/years',
  authenticate,
  requirePermission('payroll.tax.create'),
  validate(createTaxYearSchema),
  taxCtrl.createTaxYear
);

router.post(
  '/years/:id/approve',
  authenticate,
  requirePermission('payroll.tax.approve'),
  taxCtrl.approveTaxYear
);

router.post(
  '/years/:id/activate',
  authenticate,
  requirePermission('payroll.tax.activate'),
  taxCtrl.activateTaxYear
);

router.post(
  '/years/:id/archive',
  authenticate,
  requirePermission('payroll.tax.archive'),
  taxCtrl.archiveTaxYear
);

// Tax Slabs Endpoints
router.get(
  '/slabs',
  authenticate,
  requirePermission('payroll.tax.view'),
  taxCtrl.getTaxSlabs
);

router.post(
  '/slabs',
  authenticate,
  requirePermission('payroll.tax.create'),
  validate(createTaxSlabSchema),
  taxCtrl.createTaxSlab
);

router.patch(
  '/slabs/:id',
  authenticate,
  requirePermission('payroll.tax.update'),
  taxCtrl.updateTaxSlab
);

router.delete(
  '/slabs/:id',
  authenticate,
  requirePermission('payroll.tax.delete'),
  taxCtrl.deleteTaxSlab
);

// Calculation Endpoints
router.post(
  '/calculate',
  authenticate,
  requirePermission('payroll.tax.calculate'),
  validate(calculateSchema),
  taxCtrl.calculateTax
);

router.post(
  '/withholding',
  authenticate,
  requirePermission('payroll.tax.calculate'),
  validate(withholdingSchema),
  taxCtrl.calculateWithholding
);

module.exports = router;
