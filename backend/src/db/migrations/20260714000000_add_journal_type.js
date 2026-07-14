exports.up = async function(knex) {
  // 1. Create fiscal_years table if not exists
  const hasFiscalYears = await knex.schema.hasTable('fiscal_years');
  if (!hasFiscalYears) {
    await knex.schema.createTable('fiscal_years', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('year_name', 50).notNullable(); // Increased to 50 for safety
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.string('status', 20).defaultTo('OPEN'); // 'OPEN' | 'CLOSED'
      table.timestamps(true, true);

      table.unique(['company_id', 'year_name']);
      table.index(['company_id']);
    });
  }

  // 2. Alter journal_entries with existence checks for type, source, and fiscal_year_id
  const hasType = await knex.schema.hasColumn('journal_entries', 'type');
  const hasSource = await knex.schema.hasColumn('journal_entries', 'source');
  const hasFyId = await knex.schema.hasColumn('journal_entries', 'fiscal_year_id');

  if (!hasType || !hasSource || !hasFyId) {
    await knex.schema.alterTable('journal_entries', table => {
      if (!hasType) table.string('type', 20).defaultTo('NORMAL').notNullable();
      if (!hasSource) table.string('source', 20).defaultTo('MANUAL').notNullable();
      if (!hasFyId) table.integer('fiscal_year_id').nullable().references('id').inTable('fiscal_years').onDelete('SET NULL');
    });
  }

  // 3. Backfill/Seed fiscal_years based on unique years in existing accounting_periods
  const companies = await knex('companies').select('id');
  for (const company of companies) {
    const periods = await knex('accounting_periods').where({ company_id: company.id });
    if (periods.length > 0) {
      // Extract 4-digit year dynamically from start_date
      const years = [...new Set(periods.map(p => {
        if (!p.start_date) return null;
        const d = new Date(p.start_date);
        return isNaN(d.getTime()) ? null : d.getFullYear().toString();
      }))].filter(Boolean);

      for (const y of years) {
        const yearPeriods = periods.filter(p => {
          const d = new Date(p.start_date);
          return !isNaN(d.getTime()) && d.getFullYear().toString() === y;
        });
        if (yearPeriods.length === 0) continue;

        const startDate = yearPeriods.reduce((min, p) => p.start_date < min ? p.start_date : min, yearPeriods[0].start_date);
        const endDate = yearPeriods.reduce((max, p) => p.end_date > max ? p.end_date : max, yearPeriods[0].end_date);
        
        const exist = await knex('fiscal_years').where({ company_id: company.id, year_name: y }).first();
        if (!exist) {
          try {
            await knex('fiscal_years')
              .insert({
                company_id: company.id,
                year_name: y,
                start_date: startDate,
                end_date: endDate,
                status: 'OPEN'
              });
          } catch (err) {
            // Ignore conflict
          }
        }
      }
    }
  }

  // 4. Seed opening balance permissions
  const newPermissions = [
    { code: 'opening_balances.view', module: 'finance', action: 'view', description: 'View opening balances migration' },
    { code: 'opening_balances.manage', module: 'finance', action: 'manage', description: 'Edit opening balances draft' },
    { code: 'opening_balances.post', module: 'finance', action: 'post', description: 'Post opening balances to ledger' },
  ];

  await knex('permissions').insert(newPermissions).onConflict('code').ignore();

  // Fetch roles and perms to link them
  const roles = await knex('roles').select('*');
  const perms = await knex('permissions').select('*');

  const getPermId = (code) => perms.find(p => p.code === code)?.id;
  const getRoleId = (name) => roles.find(r => r.name === name)?.id;

  const roleMappings = [];
  const adminId = getRoleId('Admin');
  const accountantId = getRoleId('Accountant');
  const financeManagerId = getRoleId('Finance Manager');

  const allCodes = ['opening_balances.view', 'opening_balances.manage', 'opening_balances.post'];

  if (adminId) {
    allCodes.forEach(code => {
      const pid = getPermId(code);
      if (pid) roleMappings.push({ role_id: adminId, permission_id: pid });
    });
  }

  if (accountantId) {
    allCodes.forEach(code => {
      const pid = getPermId(code);
      if (pid) roleMappings.push({ role_id: accountantId, permission_id: pid });
    });
  }

  if (financeManagerId) {
    const pid = getPermId('opening_balances.view');
    if (pid) roleMappings.push({ role_id: financeManagerId, permission_id: pid });
  }

  const uniqueMappings = [];
  for (const m of roleMappings) {
    const exist = await knex('role_permissions').where(m).first();
    if (!exist) uniqueMappings.push(m);
  }

  if (uniqueMappings.length > 0) {
    await knex('role_permissions').insert(uniqueMappings);
  }
};

exports.down = async function(knex) {
  const codes = ['opening_balances.view', 'opening_balances.manage', 'opening_balances.post'];
  const perms = await knex('permissions').whereIn('code', codes).select('id');
  const permIds = perms.map(p => p.id);

  if (permIds.length > 0) {
    await knex('role_permissions').whereIn('permission_id', permIds).delete();
    await knex('permissions').whereIn('id', permIds).delete();
  }

  await knex.schema.alterTable('journal_entries', table => {
    table.dropColumn('fiscal_year_id');
    table.dropColumn('source');
    table.dropColumn('type');
  });

  await knex.schema.dropTableIfExists('fiscal_years');
};
