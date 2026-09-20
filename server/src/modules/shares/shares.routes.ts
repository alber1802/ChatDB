import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { shareSchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';

export const sharesRouter = Router();
sharesRouter.use(authenticate);

sharesRouter.get('/diagrams/:diagramId/shares', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, async (client) => {
            const { rows } = await client.query(
                `SELECT id, diagram_id, owner_id, shared_with, role, created_at
                 FROM diagram_shares
                 WHERE diagram_id = $1
                 ORDER BY created_at DESC`,
                [req.params.diagramId]
            );
            return rows.map((r) => ({
                id: r.id,
                diagramId: r.diagram_id,
                ownerId: r.owner_id,
                sharedWith: r.shared_with,
                role: r.role,
                createdAt: r.created_at,
            }));
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

sharesRouter.post('/diagrams/:diagramId/shares', async (req, res, next) => {
    try {
        const body = shareSchema.parse(req.body);
        const data = await withUserContext(req.user!.id, async (client) => {
            const { rows } = await client.query(
                `INSERT INTO diagram_shares (diagram_id, owner_id, shared_with, role)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, diagram_id, owner_id, shared_with, role, created_at`,
                [req.params.diagramId, req.user!.id, body.sharedWith, body.role]
            );
            const r = rows[0];
            return {
                id: r.id,
                diagramId: r.diagram_id,
                ownerId: r.owner_id,
                sharedWith: r.shared_with,
                role: r.role,
                createdAt: r.created_at,
            };
        });
        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

sharesRouter.delete(
    '/diagrams/:diagramId/shares/:shareId',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, async (client) => {
                const { rowCount } = await client.query(
                    `DELETE FROM diagram_shares
                     WHERE id = $1 AND diagram_id = $2`,
                    [req.params.shareId, req.params.diagramId]
                );
                if (!rowCount)
                    throw new AppError(404, 'Share not found', 'not_found');
            });
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);
