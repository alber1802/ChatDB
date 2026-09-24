import { Router } from 'express';
import { z } from 'zod';
import { withUserContext } from '../../config/db.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import {
    invitationCreateRateLimit,
    shareSearchRateLimit,
} from '../../middleware/rateLimit.js';
import {
    invitationCreateSchema,
    shareCandidatesQuerySchema,
} from '../../lib/schemas.js';
import { createMailer } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';
import {
    invitationsService,
    type InvitationDto,
} from './invitations.service.js';

export const invitationsRouter = Router();
invitationsRouter.use(authenticate);

const mailer = createMailer(env);
const appUrl = (env.APP_URL ?? env.CORS_ORIGIN.split(',')[0]!.trim()).replace(
    /\/$/,
    ''
);
const uuidParam = z.string().uuid();
const acceptByTokenSchema = z.object({ token: z.string().min(20).max(200) });

const inviteLink = (token: string) => `${appUrl}/invite/${token}`;

/**
 * Envía el correo DESPUÉS de confirmar la transacción. Un fallo del proveedor
 * no invalida la invitación: se informa `emailSent: false` y el modal ofrece
 * copiar el enlace.
 */
async function deliver(
    userId: string,
    diagramId: string,
    invitation: InvitationDto,
    token: string
) {
    const link = inviteLink(token);
    if (!mailer) return { inviteLink: link, emailSent: false };
    try {
        const context = await withUserContext(userId, async (client) => {
            const { rows } = await client.query(
                `SELECT d.name AS diagram_name, up.display_name AS inviter_name
                 FROM diagrams d
                 LEFT JOIN user_profiles up ON up.user_id = auth.uid()
                 WHERE d.id = $1`,
                [diagramId]
            );
            return rows[0];
        });
        await mailer.sendInvitation({
            to: invitation.email,
            inviterName: context?.inviter_name || 'Un usuario de ChartDB',
            diagramName: context?.diagram_name || 'un diagrama',
            role: invitation.role,
            link,
        });
        return { inviteLink: link, emailSent: true };
    } catch (err) {
        logger.warn(
            { err, invitationId: invitation.id },
            'Invitation email failed'
        );
        return { inviteLink: link, emailSent: false };
    }
}

// ─── Owner ──────────────────────────────────────────────────────────────────

invitationsRouter.get(
    '/diagrams/:diagramId/invitations',
    async (req, res, next) => {
        try {
            const data = await withUserContext(req.user!.id, (client) =>
                invitationsService.listForDiagram(client, req.params.diagramId)
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

invitationsRouter.post(
    '/diagrams/:diagramId/invitations',
    invitationCreateRateLimit,
    async (req, res, next) => {
        try {
            const body = invitationCreateSchema.parse(req.body);
            const { diagramId } = req.params;
            const { invitation, token } = await withUserContext(
                req.user!.id,
                (client) =>
                    invitationsService.create(
                        client,
                        diagramId,
                        body.email,
                        body.role
                    )
            );
            const delivery = await deliver(
                req.user!.id,
                diagramId,
                invitation,
                token
            );
            res.status(201).json({ invitation, ...delivery });
        } catch (err) {
            next(err);
        }
    }
);

invitationsRouter.post(
    '/diagrams/:diagramId/invitations/:invitationId/resend',
    invitationCreateRateLimit,
    async (req, res, next) => {
        try {
            const invitationId = uuidParam.parse(req.params.invitationId);
            const { invitation, token } = await withUserContext(
                req.user!.id,
                (client) => invitationsService.resend(client, invitationId)
            );
            const delivery = await deliver(
                req.user!.id,
                req.params.diagramId,
                invitation,
                token
            );
            res.json({ invitation, ...delivery });
        } catch (err) {
            next(err);
        }
    }
);

invitationsRouter.delete(
    '/diagrams/:diagramId/invitations/:invitationId',
    async (req, res, next) => {
        try {
            const invitationId = uuidParam.parse(req.params.invitationId);
            await withUserContext(req.user!.id, (client) =>
                invitationsService.revoke(client, invitationId)
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

invitationsRouter.get(
    '/diagrams/:diagramId/share-candidates',
    shareSearchRateLimit,
    async (req, res, next) => {
        try {
            const { q } = shareCandidatesQuerySchema.parse(req.query);
            const data = await withUserContext(req.user!.id, (client) =>
                invitationsService.searchCandidates(
                    client,
                    req.params.diagramId,
                    q
                )
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    }
);

// ─── Invitado ───────────────────────────────────────────────────────────────

invitationsRouter.get('/me/invitations', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, (client) =>
            invitationsService.listMine(client)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

// El token va en el cuerpo, no en la URL, para que no quede en logs de acceso.
invitationsRouter.post(
    '/invitations/accept-by-token',
    async (req, res, next) => {
        try {
            const { token } = acceptByTokenSchema.parse(req.body);
            const diagramId = await withUserContext(req.user!.id, (client) =>
                invitationsService.acceptByToken(client, token)
            );
            res.json({ diagramId });
        } catch (err) {
            next(err);
        }
    }
);

invitationsRouter.post('/invitations/:id/accept', async (req, res, next) => {
    try {
        const id = uuidParam.parse(req.params.id);
        const diagramId = await withUserContext(req.user!.id, (client) =>
            invitationsService.accept(client, id)
        );
        res.json({ diagramId });
    } catch (err) {
        next(err);
    }
});

invitationsRouter.post('/invitations/:id/decline', async (req, res, next) => {
    try {
        const id = uuidParam.parse(req.params.id);
        await withUserContext(req.user!.id, (client) =>
            invitationsService.decline(client, id)
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
