exports.up = function(knex) {
  return knex.raw(`
    CREATE OR REPLACE VIEW v_sector_revenue AS
    SELECT
      s.id          AS sector_id,
      s.company_id,
      s.name        AS sector_name,
      COUNT(d.id)   AS delivery_count,
      COALESCE(SUM(d.total_amount), 0) AS total_revenue,
      COALESCE(SUM(d.total_cost), 0)   AS total_cost,
      COALESCE(SUM(d.total_amount) - SUM(d.total_cost), 0) AS gross_profit
    FROM sectors s
    LEFT JOIN deliveries d ON (d.sector_id = s.id OR (d.sector_id IS NULL AND d.client_id IN (SELECT id FROM clients WHERE sector_id = s.id)))
      AND d.status IN ('DELIVERED', 'DISPATCHED', 'CONFIRMED')
    GROUP BY s.id, s.company_id, s.name;
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    CREATE OR REPLACE VIEW v_sector_revenue AS
    SELECT
      s.id          AS sector_id,
      s.company_id,
      s.name        AS sector_name,
      COUNT(d.id)   AS delivery_count,
      COALESCE(SUM(d.total_amount), 0) AS total_revenue,
      COALESCE(SUM(d.total_cost), 0)   AS total_cost,
      COALESCE(SUM(d.total_amount) - SUM(d.total_cost), 0) AS gross_profit
    FROM sectors s
    LEFT JOIN deliveries d ON d.sector_id = s.id AND d.status = 'DELIVERED'
    GROUP BY s.id, s.company_id, s.name;
  `);
};
