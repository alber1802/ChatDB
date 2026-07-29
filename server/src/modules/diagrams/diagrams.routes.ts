import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import {
    diagramPatchSchema,
    diagramSchema,
    includeQuerySchema,
} from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from './diagrams.service.js';
import type { DiagramDto } from '../../lib/mappers.js';

export const diagramsRouter = Router();

diagramsRouter.use(authenticate);

diagramsRouter.get('/', async (req, res, next) => {
    try {
        const options = includeQuerySchema.parse(req.query);
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.list(client, options)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

diagramsRouter.get('/:id', async (req, res, next) => {
    try {
        const options = includeQuerySchema.parse(req.query);
        const data = await withUserContext(req.user!.id, (client) =>
            diagramsService.get(client, req.params.id, options)
        );
        if (!data) throw new AppError(404, 'Diagram not found', 'not_found');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

diagramsRouter.post('/', async (req, res, next) => {
    try {
        const body = diagramSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.create(client, body as DiagramDto, req.user!.id)
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        next(err);
    }
});

diagramsRouter.patch('/:id', async (req, res, next) => {
    try {
        const body = diagramPatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.update(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

diagramsRouter.delete('/:id', async (req, res, next) => {
    try {
        await withUserContext(req.user!.id, (client) =>
            diagramsService.remove(client, req.params.id)
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
