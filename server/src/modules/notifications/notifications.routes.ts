import { Router } from 'express';
import { z } from 'zod';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { notificationsReadSchema } from '../../lib/schemas.js';
import { notificationsService } from './notifications.service.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

notificationsRouter.get('/me/notifications', async (req, res, next) => {
    try {
        const { limit } = listQuerySchema.parse(req.query);
        const data = await withUserContext(req.user!.id, (client) =>
            notificationsService.list(client, limit)
        );
        res.json(data);
    } catch (err) {
        next(err);
    }
});

notificationsRouter.post('/me/notifications/read', async (req, res, next) => {
    try {
        const { ids } = notificationsReadSchema.parse(req.body ?? {});
        await withUserContext(req.user!.id, (client) =>
            notificationsService.markRead(client, ids)
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
