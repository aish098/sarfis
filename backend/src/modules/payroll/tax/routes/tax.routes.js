const express = require('express');
const router = express.Router();
const taxCtrl = require('../controllers/tax.controller');

// Tax Years Endpoints
router.get('/years', taxCtrl.getTaxYears);
router.get('/tax-years', taxCtrl.getTaxYears);
router.post('/years', taxCtrl.createTaxYear);
router.post('/tax-years', taxCtrl.createTaxYear);

// Tax Slabs Endpoints
router.get('/slabs', taxCtrl.getTaxSlabs);
router.get('/tax-slabs', taxCtrl.getTaxSlabs);
router.post('/slabs', taxCtrl.createTaxSlab);
router.post('/tax-slabs', taxCtrl.createTaxSlab);
router.patch('/slabs/:id', taxCtrl.updateTaxSlab);
router.patch('/tax-slabs/:id', taxCtrl.updateTaxSlab);
router.delete('/slabs/:id', taxCtrl.deleteTaxSlab);
router.delete('/tax-slabs/:id', taxCtrl.deleteTaxSlab);

// Calculation Endpoints
router.post('/calculate', taxCtrl.calculateTax);
router.post('/calculate-tax', taxCtrl.calculateTax);
router.post('/withholding', taxCtrl.calculateWithholding);

module.exports = router;
