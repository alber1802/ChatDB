import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../config/db.js';
import { AppError } from '../lib/types.js';

declare global {
    // Express's own type augmentation pattern requires a namespace here;
    // there is no ES2015-module equivalent for merging into an ambient
    // global namespace.
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            db?: PoolClient;
        }
    }
}

/**
 * Express middleware variant of withUserContext.
 * Prefer the helper for service-style handlers; use this when a route
 * needs req.db across multiple middleware steps.
 */
export function withUserDbContext(handler: RequestHandler): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user?.id) {
            return next(new AppError(401, 'Unauthenticated', 'missing_token'));
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE authenticated');
            await client.query(
                `SELECT set_config('request.jwt.claim.sub', $1, true)`,
                [req.user.id]
            );
            await client.query(
                `SELECT set_config('request.jwt.claims', $1, true)`,
                [JSON.stringify({ sub: req.user.id, role: 'authenticated' })]
            );
            req.db = client;
            await Promise.resolve(handler(req, res, next));
            if (!res.writableEnded) {
                // handler did not end response synchronously — still commit
            }
            await client.query('COMMIT');
        } catch (err) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // ignore
            }
            next(err);
        } finally {
            client.release();
            delete req.db;
        }
    };
}
