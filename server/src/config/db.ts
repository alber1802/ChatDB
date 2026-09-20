import pg from 'pg';
import { env } from './env.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    // Transaction-mode pooler: keep statements short and always release
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    // Required for some Supabase pooler setups with self-signed intermediates
    ssl:
        env.NODE_ENV === 'production' || env.DATABASE_URL.includes('supabase')
            ? { rejectUnauthorized: false }
            : undefined,
});

pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected idle client error');
});

/**
 * Run work as the authenticated Supabase user so RLS/auth.uid() apply.
 * Fail-closed: if SET LOCAL ROLE is skipped, app_backend has no table grants.
 */
export async function withUserContext<T>(
    userId: string,
    fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        // auth.uid() reads request.jwt.claim.sub (and optionally request.jwt.claims)
        await client.query(
            `SELECT set_config('request.jwt.claim.sub', $1, true)`,
            [userId]
        );
        await client.query(
            `SELECT set_config('request.jwt.claims', $1, true)`,
            [JSON.stringify({ sub: userId, role: 'authenticated' })]
        );
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // ignore rollback errors
        }
        throw err;
    } finally {
        client.release();
    }
}

/** Anonymous context (e.g. public waitlist insert, login helpers). */
export async function withAnonContext<T>(
    fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE anon');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // ignore
        }
        throw err;
    } finally {
        client.release();
    }
}

export async function closePool(): Promise<void> {
    await pool.end();
}
