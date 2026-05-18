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
// Exports:
//   module.exports.query  — callback-style wrapper (used by routes)
//   module.exports.pool   — raw pg Pool (used by connect-pg-simple session store)
// ============================================================

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool — pg manages a set of idle connections
// and reuses them across requests for better performance.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon')
    ? { rejectUnauthorized: false }
    : false
});

// Test the connection on startup and log the result.
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
//   3. Return result.rows via callback, matching the MySQL2 callback signature
const connection = {
  query: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    let count = 0;
    const convertedSql = sql.replace(/\?/g, () => '$' + (++count));
    pool.query(convertedSql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, result.rows);
    });
  }
};

// Export both: the query wrapper (for routes) and the raw pool (for sessions)
module.exports         = connection;
module.exports.pool    = pool;
