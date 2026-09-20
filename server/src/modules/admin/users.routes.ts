import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { userPatchSchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { getRedis } from '../../config/redis.js';

export const adminUsersRouter = Router();
adminUsersRouter.use(authenticate);

const memoryCache = new Map<string, { expires: number; value: unknown }>();

async function cachedUsers(userId: string, fetcher: () => Promise<unknown>) {
    const key = `admin:users:${userId}`;
    const redis = getRedis();
    if (redis) {
        const hit = await redis.get(key);
        if (hit) return JSON.parse(hit);
        const value = await fetcher();
        await redis.set(key, JSON.stringify(value), 'EX', 15);
        return value;
    }
    const mem = memoryCache.get(key);
    if (mem && mem.expires > Date.now()) return mem.value;
    const value = await fetcher();
    memoryCache.set(key, { expires: Date.now() + 15_000, value });
    return value;
}

adminUsersRouter.get('/users', async (req, res, next) => {
    try {
        const data = await cachedUsers(req.user!.id, () =>
            withUserContext(req.user!.id, async (client) => {
                const { rows } = await client.query(
                    `SELECT * FROM get_admin_users()`
                );
                return rows;
            })
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

adminUsersRouter.patch('/users/:id', async (req, res, next) => {
    try {
        const body = userPatchSchema.parse(req.body);
        await withUserContext(req.user!.id, async (client) => {
            const sets: string[] = [];
            const values: unknown[] = [];
            let i = 1;

            if (body.displayName !== undefined) {
                sets.push(`display_name = $${i++}`);
                values.push(body.displayName);
            }
            if (body.roleId !== undefined) {
                sets.push(`role_id = $${i++}`);
                values.push(body.roleId);
            }
            if (body.isBlocked !== undefined) {
                sets.push(`is_blocked = $${i++}`);
                values.push(body.isBlocked);
            }
            if (body.blockedReason !== undefined) {
                sets.push(`blocked_reason = $${i++}`);
                values.push(body.blockedReason);
            }
            sets.push(`updated_at = NOW()`);

            if (sets.length === 1) {
                throw new AppError(
                    400,
                    'No fields to update',
                    'validation_error'
                );
            }

            values.push(req.params.id);
            const { rowCount } = await client.query(
                `UPDATE user_profiles SET ${sets.join(', ')} WHERE user_id = $${i}`,
                values
            );
            if (!rowCount)
                throw new AppError(404, 'User profile not found', 'not_found');

            await client.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                 VALUES ($1, 'user.update', 'user_profiles', $2, $3::jsonb)`,
                [req.user!.id, req.params.id, JSON.stringify(body)]
            );
        });

        const redis = getRedis();
        if (redis) await redis.del(`admin:users:${req.user!.id}`);
        memoryCache.delete(`admin:users:${req.user!.id}`);

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

adminUsersRouter.delete('/users/:id', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, async (client) => {
            // Prefer SECURITY DEFINER RPC when present; otherwise cascade via owned rows
            const { rows: procs } = await client.query(
                `SELECT 1 FROM pg_proc p
                 JOIN pg_namespace n ON p.pronamespace = n.oid
                 WHERE n.nspname = 'public' AND p.proname = 'delete_user_data'
                 LIMIT 1`
            );
            if (procs.length > 0) {
                await client.query(`SELECT delete_user_data($1::uuid)`, [
                    req.params.id,
                ]);
            } else {
                // Fallback: mark blocked + delete diagrams (cascade children)
                await client.query(
                    `UPDATE user_profiles
                     SET is_blocked = true,
                         blocked_reason = COALESCE(blocked_reason, 'Deleted by admin'),
                         updated_at = NOW()
                     WHERE user_id = $1`,
                    [req.params.id]
                );
                await client.query(`DELETE FROM diagrams WHERE user_id = $1`, [
                    req.params.id,
                ]);
            }

            await client.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                 VALUES ($1, 'user.delete', 'user_profiles', $2, '{}'::jsonb)`,
                [req.user!.id, req.params.id]
            );
        });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
