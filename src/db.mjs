import pg from 'pg';

const { Pool } = pg;

const useSsl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl
});

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error);
});
