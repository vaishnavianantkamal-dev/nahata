import { Pool, QueryResult } from 'pg';
import { logger } from './logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
  logger.error({ err }, 'Unexpected error on idle client');
});

export async function query(sql: string, params?: any[]): Promise<any> {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    logger.error({ sql, params, error: err }, 'Database query error');
    throw err;
  }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function queryMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await query(sql, params);
  return result.rows;
}

export async function transaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function connectDB() {
  try {
    await pool.query('SELECT NOW()');
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database');
    throw err;
  }
}

export async function disconnectDB() {
  await pool.end();
  logger.info('Database disconnected');
}

export { pool };
