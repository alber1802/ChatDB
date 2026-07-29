import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { filterSchema } from '../../lib/schemas.js';
import { filterToRow, rowToFilter } from '../../lib/mappers.js';
import { AppError } from '../../lib/types.js';

export const filtersRouter = Router();
filtersRouter.use(authenticate);

filtersRouter.get('/diagrams/:diagramId/filter', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, async (client) => {
            const { rows } = await client.query(
                `SELECT * FROM diagram_filters WHERE diagram_id = $1`,
                [req.params.diagramId]
            );
            return rows[0] ? rowToFilter(rows[0]) : null;
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

filtersRouter.put('/diagrams/:diagramId/filter', async (req, res, next) => {
    try {
        const body = filterSchema.parse(req.body);
        await withUserContext(req.user!.id, async (client) => {
            const row = filterToRow(body, req.params.diagramId, req.user!.id);
            await client.query(
                `INSERT INTO diagram_filters (diagram_id, user_id, table_ids, schemas_ids)
                 VALUES ($1, $2, $3::jsonb, $4::jsonb)
                 ON CONFLICT (diagram_id) DO UPDATE
                 SET table_ids = EXCLUDED.table_ids,
                     schemas_ids = EXCLUDED.schemas_ids,
                     user_id = EXCLUDED.user_id`,
                [row.diagram_id, row.user_id, row.table_ids, row.schemas_ids]
            );
        });
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

filtersRouter.delete('/diagrams/:diagramId/filter', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, async (client) => {
            const { rowCount } = await client.query(
                `DELETE FROM diagram_filters WHERE diagram_id = $1`,
                [req.params.diagramId]
            );
            if (!rowCount)
                throw new AppError(404, 'Filter not found', 'not_found');
        });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
