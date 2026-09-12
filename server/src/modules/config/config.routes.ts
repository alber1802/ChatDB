import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { configSchema } from '../../lib/schemas.js';

export const configRouter = Router();
configRouter.use(authenticate);

configRouter.get('/me/config', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, async (client) => {
            const { rows } = await client.query(
                `SELECT default_diagram_id FROM user_config WHERE user_id = $1`,
                [req.user!.id]
            );
            if (!rows[0]) return null;
            return {
                defaultDiagramId: rows[0].default_diagram_id || '',
            };
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

configRouter.put('/me/config', async (req, res, next) => {
    try {
        const body = configSchema.parse(req.body);
        await withUserContext(req.user!.id, async (client) => {
            await client.query(
                `INSERT INTO user_config (user_id, default_diagram_id, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (user_id) DO UPDATE
                 SET default_diagram_id = EXCLUDED.default_diagram_id,
                     updated_at = NOW()`,
                [req.user!.id, body.defaultDiagramId ?? null]
            );
        });
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});
