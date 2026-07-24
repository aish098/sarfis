exports.seed = async function(knex) {
  // Check if PK-2026-27-SALARY already exists
  let taxYear = await knex('tax_years').where({ code: 'PK-2026-27-SALARY' }).first();

  if (!taxYear) {
    const [insertedId] = await knex('tax_years').insert({
      code: 'PK-2026-27-SALARY',
      name: 'Pakistan Income Tax Slabs 2026–27 (Salary)',
      country_code: 'PK',
      currency_code: 'PKR',
      tax_category: 'SALARY',
      effective_from: '2026-07-01',
      effective_to: '2027-06-30',
      status: 'ACTIVE',
      version: 1,
      source_reference: 'Finance Bill 2026 / First Schedule Part I',
      source_version: 'Enacted 2026',
      published_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');

    const yearId = typeof insertedId === 'object' ? insertedId.id : insertedId;
    taxYear = { id: yearId };
  }

  // Delete old slabs if re-seeding
  await knex('tax_slabs').where({ tax_year_id: taxYear.id }).del();

  // Insert standard continuous 8 statutory slabs for PK-2026-27-SALARY
  const slabs = [
    {
      tax_year_id: taxYear.id,
      sequence_no: 1,
      lower_bound: 0,
      upper_bound: 600000,
      base_tax: 0,
      marginal_rate: 0.00,
      excess_over: 0,
      description: 'Up to Rs. 600,000 (0% Tax)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 2,
      lower_bound: 600000,
      upper_bound: 1200000,
      base_tax: 0,
      marginal_rate: 0.01,
      excess_over: 600000,
      description: 'Rs. 600,001 – 1,200,000 (1% of amount exceeding Rs. 600,000)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 3,
      lower_bound: 1200000,
      upper_bound: 2200000,
      base_tax: 6000,
      marginal_rate: 0.11,
      excess_over: 1200000,
      description: 'Rs. 1,200,001 – 2,200,000 (Rs. 6,000 + 11% of amount exceeding Rs. 1,200,000)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 4,
      lower_bound: 2200000,
      upper_bound: 3200000,
      base_tax: 116000,
      marginal_rate: 0.20,
      excess_over: 2200000,
      description: 'Rs. 2,200,001 – 3,200,000 (Rs. 116,000 + 20% of amount exceeding Rs. 2,200,000)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 5,
      lower_bound: 3200000,
      upper_bound: 4100000,
      base_tax: 316000,
      marginal_rate: 0.25,
      excess_over: 3200000,
      description: 'Rs. 3,200,001 – 4,100,000 (Rs. 316,000 + 25% of amount exceeding Rs. 3,200,000)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 6,
      lower_bound: 4100000,
      upper_bound: 5600000,
      base_tax: 541000,
      marginal_rate: 0.29,
      excess_over: 4100000,
      description: 'Rs. 4,100,001 – 5,600,000 (Rs. 541,000 + 29% of amount exceeding Rs. 4,100,000)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 7,
      lower_bound: 5600000,
      upper_bound: 7000000,
      base_tax: 976000,
      marginal_rate: 0.32,
      excess_over: 5600000,
      description: 'Rs. 5,600,001 – 7,000,000 (Rs. 976,000 + 32% of amount exceeding Rs. 5,600,000)'
    },
    {
      tax_year_id: taxYear.id,
      sequence_no: 8,
      lower_bound: 7000000,
      upper_bound: null,
      base_tax: 1424000,
      marginal_rate: 0.35,
      excess_over: 7000000,
      description: 'Above Rs. 7,000,000 (Rs. 1,424,000 + 35% of amount exceeding Rs. 7,000,000)'
    }
  ];

  await knex('tax_slabs').insert(slabs.map(s => ({
    ...s,
    created_at: new Date(),
    updated_at: new Date()
  })));

  console.log('[SEED] Pakistan Tax Year 2026-27 & 8 Slabs seeded successfully.');
};
