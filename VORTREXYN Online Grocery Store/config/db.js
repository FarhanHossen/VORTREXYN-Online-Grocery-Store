const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  release();
  console.log('✅ Connected to PostgreSQL');
});

const connection = {
  query: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const pgSql = sql.replace(/\?/g, (_, i) => {
      let count = 0;
      for (let j = 0; j < _.length; j++) count++;
      return '$' + (++pgSql._paramCount);
    });
    let paramCount = 0;
    const convertedSql = sql.replace(/\?/g, () => '$' + (++paramCount));
    pool.query(convertedSql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, result.rows);
    });
  }
};

module.exports = connection;
