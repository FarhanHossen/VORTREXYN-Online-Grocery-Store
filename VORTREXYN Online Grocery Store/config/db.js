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
  console.log('Connected to PostgreSQL');
});

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

module.exports = connection;
