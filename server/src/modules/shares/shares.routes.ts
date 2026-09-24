import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { shareCreateSchema, shareRolePatchSchema } from '../../lib/schemas.js';
import { sharesService } from './shares.service.js';
import { realtime } from '../realtime/realtime.js';

// Dos formas de dar acceso (docs/collaboration/02-sharing-and-permissions.md):
// directa a un usuario del sistema (POST aquí, con notificación interna) o
// invitación por email (modules/invitations).
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

sharesRouter.post('/diagrams/:diagramId/shares', async (req, res, next) => {
    try {
        const { userId, role } = shareCreateSchema.parse(req.body);
        const id = await withUserContext(req.user!.id, (client) =>
            sharesService.shareWithUser(
                client,
                req.params.diagramId,
                userId,
                role
            )
        );
        res.status(201).json({ id });
    } catch (err) {
        next(err);
    }
});

sharesRouter.patch(
    '/diagrams/:diagramId/shares/:shareId',
    async (req, res, next) => {
        try {
            const { role } = shareRolePatchSchema.parse(req.body);
            const affected = await withUserContext(req.user!.id, (client) =>
                sharesService.updateRole(
                    client,
                    req.params.diagramId,
                    req.params.shareId,
                    role
                )
            );
            // Sus sockets abiertos cambian a lector/editor sin recargar.
            if (affected)
                realtime.accessChanged(req.params.diagramId, affected);
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
            realtime.accessChanged(req.params.diagramId, req.user!.id);
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
            const affected = await withUserContext(req.user!.id, (client) =>
                sharesService.remove(
                    client,
                    req.params.diagramId,
                    req.params.shareId
                )
            );
            // Revocado: el servidor WebSocket lo saca de la sala al instante.
            if (affected)
                realtime.accessChanged(req.params.diagramId, affected);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);
