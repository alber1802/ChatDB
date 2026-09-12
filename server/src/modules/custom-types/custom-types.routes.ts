import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import {
    customTypePatchSchema,
    customTypeSchema,
} from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type { CustomTypeDto } from '../../lib/mappers.js';

export const customTypesRouter = Router();
customTypesRouter.use(authenticate);

customTypesRouter.get(
    '/diagrams/:diagramId/custom-types',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                diagramsService.listCustomTypes(client, req.params.diagramId)
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

customTypesRouter.get(
    '/diagrams/:diagramId/custom-types/:id',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                diagramsService.getCustomType(
                    client,
                    req.params.diagramId,
                    req.params.id
                )
            );
            if (!data)
                throw new AppError(404, 'Custom type not found', 'not_found');
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

customTypesRouter.post(
    '/diagrams/:diagramId/custom-types',
    async (req, res, next) => {
        try {
            const body = customTypeSchema.parse(req.body);
            await withUserContext(req.user!.id, (client) =>
                diagramsService.upsertCustomType(
                    client,
                    req.params.diagramId,
                    body as CustomTypeDto,
                    req.user!.id
                )
            );
            res.status(201).json({ ok: true });
        } catch (err) {
            next(err);
        }
    }
);

customTypesRouter.patch('/custom-types/:id', async (req, res, next) => {
    try {
        const body = customTypePatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.updateCustomType(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

customTypesRouter.delete(
    '/diagrams/:diagramId/custom-types/:id',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteCustomType(
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

customTypesRouter.delete(
    '/diagrams/:diagramId/custom-types',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteDiagramCustomTypes(
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
