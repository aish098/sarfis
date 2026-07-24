// Standalone pure Node.js verification test for Pakistan Finance Bill 2026 Salary Tax Engine

const slabs = [
  { sequence_no: 1, lower_bound: 0, upper_bound: 600000, base_tax: 0, marginal_rate: 0.00, excess_over: 0, description: 'Up to Rs. 600,000 (0%)' },
  { sequence_no: 2, lower_bound: 600000, upper_bound: 1200000, base_tax: 0, marginal_rate: 0.01, excess_over: 600000, description: 'Rs. 600,001 – 1,200,000 (1%)' },
  { sequence_no: 3, lower_bound: 1200000, upper_bound: 2200000, base_tax: 6000, marginal_rate: 0.11, excess_over: 1200000, description: 'Rs. 1,200,001 – 2,200,000 (Rs. 6,000 + 11%)' },
  { sequence_no: 4, lower_bound: 2200000, upper_bound: 3200000, base_tax: 116000, marginal_rate: 0.20, excess_over: 2200000, description: 'Rs. 2,200,001 – 3,200,000 (Rs. 116,000 + 20%)' },
  { sequence_no: 5, lower_bound: 3200000, upper_bound: 4100000, base_tax: 316000, marginal_rate: 0.25, excess_over: 3200000, description: 'Rs. 3,200,001 – 4,100,000 (Rs. 316,000 + 25%)' },
  { sequence_no: 6, lower_bound: 4100000, upper_bound: 5600000, base_tax: 541000, marginal_rate: 0.29, excess_over: 4100000, description: 'Rs. 4,100,001 – 5,600,000 (Rs. 541,000 + 29%)' },
  { sequence_no: 7, lower_bound: 5600000, upper_bound: 7000000, base_tax: 976000, marginal_rate: 0.32, excess_over: 5600000, description: 'Rs. 5,600,001 – 7,000,000 (Rs. 976,000 + 32%)' },
  { sequence_no: 8, lower_bound: 7000000, upper_bound: null, base_tax: 1424000, marginal_rate: 0.35, excess_over: 7000000, description: 'Above Rs. 7,000,000 (Rs. 1,424,000 + 35%)' }
];

function calculateAnnualTax(income) {
  let matchedSlab = null;
  for (const slab of slabs) {
    const lower = slab.lower_bound;
    const upper = slab.upper_bound;
    if (income === 0 && lower === 0) {
      matchedSlab = slab;
      break;
    }
    if (income > lower && (upper === null || income <= upper)) {
      matchedSlab = slab;
      break;
    }
    if (income === lower && lower === 0) {
      matchedSlab = slab;
      break;
    }
  }
  if (!matchedSlab) matchedSlab = slabs[slabs.length - 1];

  const baseTax = matchedSlab.base_tax;
  const rate = matchedSlab.marginal_rate;
  const excessOver = matchedSlab.excess_over;

  const excessAmount = Math.max(0, income - excessOver);
  const marginalTax = excessAmount * rate;
  const annualTax = Math.round((baseTax + marginalTax) * 100) / 100;
  const monthlyAverageTax = Math.round((annualTax / 12) * 100) / 100;
  const effectiveRate = income > 0 ? Math.round((annualTax / income) * 10000) / 100 : 0;

  return {
    annualTax,
    monthlyAverageTax,
    effectiveRate,
    slab: matchedSlab
  };
}

const testCases = [
  { income: 0, expectedAnnualTax: 0 },
  { income: 600000, expectedAnnualTax: 0 },
  { income: 600000.01, expectedAnnualTax: 0.00 },
  { income: 1200000, expectedAnnualTax: 6000 },
  { income: 1850000, expectedAnnualTax: 77500 },
  { income: 2200000, expectedAnnualTax: 116000 },
  { income: 3200000, expectedAnnualTax: 316000 },
  { income: 4100000, expectedAnnualTax: 541000 },
  { income: 5600000, expectedAnnualTax: 976000 },
  { income: 7000000, expectedAnnualTax: 1424000 },
  { income: 8000000, expectedAnnualTax: 1774000 }
];

console.log('========================================================================');
console.log('  PAKISTAN INCOME TAX ENGINE (TY 2026-27) STATUTORY BOUNDARY VERIFICATION');
console.log('========================================================================');

let passCount = 0;
for (const tc of testCases) {
  const res = calculateAnnualTax(tc.income);
  const match = Math.abs(res.annualTax - tc.expectedAnnualTax) < 0.05;

  if (match) {
    passCount++;
    console.log(`✅ Income: PKR ${tc.income.toLocaleString().padStart(10)} -> Annual Tax: PKR ${res.annualTax.toLocaleString().padStart(10)} | Monthly: PKR ${res.monthlyAverageTax.toLocaleString().padStart(9)} | Rate: ${res.effectiveRate.toFixed(2)}% | Slab #${res.slab.sequence_no}`);
  } else {
    console.error(`❌ FAILED for Income PKR ${tc.income}! Expected: ${tc.expectedAnnualTax}, Got: ${res.annualTax}`);
  }
}

console.log('========================================================================');
console.log(`[RESULT] Passed ${passCount} / ${testCases.length} boundary tests.`);
if (passCount === testCases.length) {
  console.log('✨ ALL 11 FBR TAX SLAB BOUNDARY TEST CASES VERIFIED 100% CLEANLY!');
}
console.log('========================================================================');
