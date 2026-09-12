import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import {
    relationshipPatchSchema,
    relationshipSchema,
} from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type { RelationshipDto } from '../../lib/mappers.js';

export const relationshipsRouter = Router();
relationshipsRouter.use(authenticate);

relationshipsRouter.get(
    '/diagrams/:diagramId/relationships',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                diagramsService.listRelationships(client, req.params.diagramId)
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

relationshipsRouter.get(
    '/diagrams/:diagramId/relationships/:id',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                diagramsService.getRelationship(
                    client,
                    req.params.diagramId,
                    req.params.id
                )
            );
            if (!data)
                throw new AppError(404, 'Relationship not found', 'not_found');
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

relationshipsRouter.post(
    '/diagrams/:diagramId/relationships',
    async (req, res, next) => {
        try {
            const body = relationshipSchema.parse(req.body);
            await withUserContext(req.user!.id, (client) =>
                diagramsService.upsertRelationship(
                    client,
                    req.params.diagramId,
                    body as RelationshipDto,
                    req.user!.id
                )
            );
            res.status(201).json({ ok: true });
        } catch (err) {
            next(err);
        }
    }
);

relationshipsRouter.patch('/relationships/:id', async (req, res, next) => {
    try {
        const body = relationshipPatchSchema.parse(req.body);
        await withUserContext(req.user!.id, (client) =>
            diagramsService.updateRelationship(client, req.params.id, body)
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

relationshipsRouter.delete(
    '/diagrams/:diagramId/relationships/:id',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteRelationship(
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

relationshipsRouter.delete(
    '/diagrams/:diagramId/relationships',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                diagramsService.deleteDiagramRelationships(
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
