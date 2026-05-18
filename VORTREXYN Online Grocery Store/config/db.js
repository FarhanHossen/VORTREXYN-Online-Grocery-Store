// ============================================================
// config/db.js — PostgreSQL database connection
//
// Uses the 'pg' (node-postgres) library with a connection pool.
// The DATABASE_URL environment variable must be set in the environment
// to point at your PostgreSQL instance (e.g. in a .env file or host config).
//
// IMPORTANT: This module exposes a MySQL-style interface
// (callback-based, using '?' placeholders) even though the
// underlying driver is PostgreSQL (which uses '$1, $2, ...' style).
// The query() wrapper converts '?' → '$1', '$2', etc. automatically,
// so all route files can use familiar MySQL syntax.
//
// Usage in route files:
//   const db = require('../config/db');
//   db.query('SELECT * FROM products WHERE product_id = ?', [id], (err, rows) => { ... });
// ============================================================

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool — pg manages a set of idle connections
// and reuses them across requests for better performance.
// Pool size defaults to 10 concurrent connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection on startup and log the result.
// 'release()' returns the test client back to the pool immediately.
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  release();
  console.log('Connected to PostgreSQL');
});

// ── Query wrapper ─────────────────────────────────────────────────────────────
// Wraps pool.query() to:
//   1. Accept optional params (supports db.query(sql, callback) shorthand)
//   2. Convert MySQL-style '?' placeholders → PostgreSQL '$1', '$2', ...
//   3. Return result.rows (the array of row objects) via callback,
//      matching the MySQL2 callback signature used throughout the app.
const connection = {
  query: (sql, params, callback) => {

    // Allow omitting params: db.query('SELECT 1', callback)
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    // Replace each '?' with '$1', '$2', ... in order of appearance
    let count = 0;
    const convertedSql = sql.replace(/\?/g, () => '$' + (++count));

    // Run the query and return rows (or error) via callback
    pool.query(convertedSql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, result.rows);
    });
  }
};

module.exports = connection;
