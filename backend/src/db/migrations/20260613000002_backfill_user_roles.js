/**
 * Backfills user_roles for existing company_users that were created before the RBAC patch.
 */
exports.up = async function(knex) {
  const users = await knex('company_users').select('*');
  const roles = await knex('roles').select('*');
  
  if (roles.length === 0) return; // RBAC roles not seeded yet

  for (let u of users) {
    let r = u.role;
    if (r === 'Company Admin') r = 'Admin';
    if (r === 'Super Admin') r = 'Admin';
    
    const roleRec = roles.find(x => x.name === r);
    if (roleRec) {
      await knex('user_roles').insert({
        user_id: u.user_id,
        company_id: u.company_id,
        role_id: roleRec.id
      }).onConflict(['user_id', 'company_id', 'role_id']).ignore();
    }
  }
};

exports.down = async function(knex) {
  // Down migration not required for a backfill script
};
