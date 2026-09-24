import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { shareRolePatchSchema } from '../../lib/schemas.js';
import { sharesService } from './shares.service.js';

// Las altas de miembros NO se hacen aquí: pasan por invitaciones (Fase 2,
// docs/collaboration/02-sharing-and-permissions.md) para que nadie reciba
// acceso sin aceptarlo.
export const sharesRouter = Router();
sharesRouter.use(authenticate);

sharesRouter.get('/diagrams/:diagramId/shares', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            sharesService.list(client, req.params.diagramId)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

sharesRouter.patch(
    '/diagrams/:diagramId/shares/:shareId',
    async (req, res, next) => {
        try {
            const { role } = shareRolePatchSchema.parse(req.body);
            await withUserContext(req.user!.id, (client) =>
                sharesService.updateRole(
                    client,
                    req.params.diagramId,
                    req.params.shareId,
                    role
                )
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

// Debe declararse antes de `/:shareId` para que "me" no se interprete como id.
sharesRouter.delete(
    '/diagrams/:diagramId/shares/me',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                sharesService.leave(client, req.params.diagramId, req.user!.id)
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

sharesRouter.delete(
    '/diagrams/:diagramId/shares/:shareId',
    async (req, res, next) => {
        try {
            await withUserContext(req.user!.id, (client) =>
                sharesService.remove(
                    client,
                    req.params.diagramId,
                    req.params.shareId
                )
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);
