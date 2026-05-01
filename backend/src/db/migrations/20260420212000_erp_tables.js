const fs = require('fs');
const path = require('path');

exports.up = function(knex) {
  const sql = fs.readFileSync(path.join(__dirname, '../../../migrations/001_erp_tables.sql'), 'utf-8');
  return knex.raw(sql);
};

exports.down = function(knex) {
  return knex.raw(`
    DROP VIEW IF EXISTS v_client_balance;
    DROP VIEW IF EXISTS v_sector_revenue;
    DROP VIEW IF EXISTS v_stock_summary;
    DROP TABLE IF EXISTS delivery_items;
    DROP TABLE IF EXISTS deliveries;
    DROP TABLE IF EXISTS stock_logs;
    DROP TABLE IF EXISTS inventory;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS clients;
    DROP TABLE IF EXISTS sectors;
    DROP TABLE IF EXISTS warehouses;
  `);
};
