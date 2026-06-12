exports.up = function(knex) {
  return knex.raw(`
    CREATE OR REPLACE VIEW v_client_balance AS
    SELECT
      c.id,
      c.company_id,
      c.name,
      c.credit_limit,
      c.current_balance,
      c.credit_limit - c.current_balance AS available_credit,
      CASE WHEN c.credit_limit > 0 AND c.current_balance >= c.credit_limit THEN TRUE ELSE FALSE END AS credit_blocked
    FROM clients c;
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    CREATE OR REPLACE VIEW v_client_balance AS
    SELECT
      c.id,
      c.company_id,
      c.name,
      c.credit_limit,
      c.current_balance,
      c.credit_limit - c.current_balance AS available_credit,
      CASE WHEN c.current_balance >= c.credit_limit THEN TRUE ELSE FALSE END AS credit_blocked
    FROM clients c;
  `);
};
