import pg, { type PoolClient } from 'pg';

export const pool = new pg.Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'eco',
        password: process.env.PGPASSWORD || 'eco_dev_password',
        database: process.env.PGDATABASE || 'eco',
      }),
  max: 10,
  connectionTimeoutMillis: 5_000,
});

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
