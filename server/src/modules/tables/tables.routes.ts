import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { tablePatchSchema, tableSchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type { TableDto } from '../../lib/mappers.js';

export const tablesRouter = Router();
tablesRouter.use(authenticate);

tablesRouter.get('/diagrams/:diagramId/tables', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.listTables(client, req.params.diagramId)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

tablesRouter.get('/diagrams/:diagramId/tables/:id', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.getTable(
                client,
                req.params.diagramId,
                req.params.id
            )
        );
        if (!data) throw new AppError(404, 'Table not found', 'not_found');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

tablesRouter.post('/diagrams/:diagramId/tables', async (req, res, next) => {
    try {
        const body = tableSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.upsertTable(
                client,
                req.params.diagramId,
                body as TableDto,
                req.user!.id
            )
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

tablesRouter.put('/diagrams/:diagramId/tables/:id', async (req, res, next) => {
    try {
        const body = tableSchema.parse({ ...req.body, id: req.params.id });
        await withUserContext(req.user!.id, (client) =>
            diagramsService.upsertTable(
                client,
                req.params.diagramId,
                body as TableDto,
                req.user!.id
            )
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

tablesRouter.patch('/tables/:id', async (req, res, next) => {
    try {
        const body = tablePatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.updateTable(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

tablesRouter.delete(
    '/diagrams/:diagramId/tables/:id',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteTable(
                    client,
                    req.params.diagramId,
                    req.params.id
                )
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

tablesRouter.delete('/diagrams/:diagramId/tables', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, (client) =>
            diagramsService.deleteDiagramTables(client, req.params.diagramId)
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
