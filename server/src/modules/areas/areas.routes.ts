import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { areaPatchSchema, areaSchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type { AreaDto } from '../../lib/mappers.js';

export const areasRouter = Router();
areasRouter.use(authenticate);

areasRouter.get('/diagrams/:diagramId/areas', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.listAreas(client, req.params.diagramId)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

areasRouter.get('/diagrams/:diagramId/areas/:id', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.getArea(client, req.params.diagramId, req.params.id)
        );
        if (!data) throw new AppError(404, 'Area not found', 'not_found');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

areasRouter.post('/diagrams/:diagramId/areas', async (req, res, next) => {
    try {
        const body = areaSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.upsertArea(
                client,
                req.params.diagramId,
                body as AreaDto,
                req.user!.id
            )
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

areasRouter.patch('/areas/:id', async (req, res, next) => {
    try {
        const body = areaPatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.updateArea(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

areasRouter.delete('/diagrams/:diagramId/areas/:id', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, (client) =>
            diagramsService.deleteArea(
                client,
                req.params.diagramId,
                req.params.id
            )
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

areasRouter.delete('/diagrams/:diagramId/areas', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, (client) =>
            diagramsService.deleteDiagramAreas(client, req.params.diagramId)
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
