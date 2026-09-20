import { Router } from 'express';
import { withAnonContext, withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import {
    waitlistInsertSchema,
    waitlistPatchSchema,
} from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';

export const waitlistRouter = Router();

/** Public join waitlist */
waitlistRouter.post('/waitlist', async (req, res, next) => {
    try {
        const body = waitlistInsertSchema.parse(req.body);
        await withAnonContext(async (client) => {
            await client.query(
                `INSERT INTO waitlist (email, status)
                 VALUES ($1, 'pending')
                 ON CONFLICT (email) DO NOTHING`,
                [body.email.toLowerCase().trim()]
            );
        });
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

const adminWaitlist = Router();
adminWaitlist.use(authenticate);

adminWaitlist.get('/admin/waitlist', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, async (client) => {
            const { rows } = await client.query(
                `SELECT * FROM waitlist ORDER BY requested_at DESC`
            );
            return rows;
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

adminWaitlist.patch('/admin/waitlist/:id', async (req, res, next) => {
    try {
        const body = waitlistPatchSchema.parse(req.body);
        await withUserContext(req.user!.id, async (client) => {
            const { rowCount } = await client.query(
                `UPDATE waitlist
                 SET status = $1,
                     notes = COALESCE($2, notes),
                     approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
                     approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE approved_by END
                 WHERE id = $4`,
                [body.status, body.notes ?? null, req.user!.id, req.params.id]
            );
            if (!rowCount)
                throw new AppError(
                    404,
                    'Waitlist entry not found',
                    'not_found'
                );
        });
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

waitlistRouter.use(adminWaitlist);
