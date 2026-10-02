const { Pool } = require('pg');

const connectionString = String(process.env.DATABASE_URL || '').trim();
if (!connectionString) {
  console.warn('[DB CONFIG] DATABASE_URL is missing. The server will start, but database-backed features will be unavailable until .env is fixed.');
}

const pool = new Pool({
  connectionString: connectionString || undefined,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : undefined
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
