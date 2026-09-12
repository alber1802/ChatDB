import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { dependencyPatchSchema, dependencySchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type { DependencyDto } from '../../lib/mappers.js';

export const dependenciesRouter = Router();
dependenciesRouter.use(authenticate);

dependenciesRouter.get(
    '/diagrams/:diagramId/dependencies',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                diagramsService.listDependencies(client, req.params.diagramId)
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

dependenciesRouter.get(
    '/diagrams/:diagramId/dependencies/:id',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                diagramsService.getDependency(
                    client,
                    req.params.diagramId,
                    req.params.id
                )
            );
            if (!data)
                throw new AppError(404, 'Dependency not found', 'not_found');
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

dependenciesRouter.post(
    '/diagrams/:diagramId/dependencies',
    async (req, res, next) => {
        try {
            const body = dependencySchema.parse(req.body);
            await withUserContext(req.user!.id, (client) =>
                diagramsService.upsertDependency(
                    client,
                    req.params.diagramId,
                    body as DependencyDto,
                    req.user!.id
                )
            );
            res.status(201).json({ ok: true });
        } catch (err) {
            next(err);
        }
    }
);

dependenciesRouter.patch('/dependencies/:id', async (req, res, next) => {
    try {
        const body = dependencyPatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.updateDependency(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

dependenciesRouter.delete(
    '/diagrams/:diagramId/dependencies/:id',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteDependency(
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

dependenciesRouter.delete(
    '/diagrams/:diagramId/dependencies',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteDiagramDependencies(
                    client,
                    req.params.diagramId
                )
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);
