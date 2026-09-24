import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { diagramsRouter } from './modules/diagrams/diagrams.routes.js';
import { tablesRouter } from './modules/tables/tables.routes.js';
import { relationshipsRouter } from './modules/relationships/relationships.routes.js';
import { dependenciesRouter } from './modules/dependencies/dependencies.routes.js';
import { areasRouter } from './modules/areas/areas.routes.js';
import { customTypesRouter } from './modules/custom-types/custom-types.routes.js';
import { notesRouter } from './modules/notes/notes.routes.js';
import { configRouter } from './modules/config/config.routes.js';
import { filtersRouter } from './modules/filters/filters.routes.js';
import { sharesRouter } from './modules/shares/shares.routes.js';
import { invitationsRouter } from './modules/invitations/invitations.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { adminUsersRouter } from './modules/admin/users.routes.js';
import { waitlistRouter } from './modules/admin/waitlist.routes.js';
import { auditRouter } from './modules/admin/audit.routes.js';
import { authRouter } from './modules/auth/login.routes.js';
import { pool } from './config/db.js';

export function createApp() {
    const app = express();

    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(
        cors({
            origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
            credentials: true,
        })
    );
    app.use(express.json({ limit: '2mb' }));
    app.use(
        pinoHttp({
            logger,
            autoLogging: {
                ignore: (req: IncomingMessage) => (req.url ?? '') === '/health',
            },
            serializers: {
                req(req: IncomingMessage & { id?: unknown }) {
                    return {
                        id: req.id,
                        method: req.method,
                        url: req.url,
                    };
                },
            },
        })
    );
    app.use(globalRateLimit);

    app.get('/health', async (_req, res) => {
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok', db: 'up' });
        } catch {
            res.status(503).json({ status: 'degraded', db: 'down' });
        }
    });

    app.use('/auth', authRouter);
    app.use(waitlistRouter);

    app.use('/diagrams', diagramsRouter);
    app.use(tablesRouter);
    app.use(relationshipsRouter);
    app.use(dependenciesRouter);
    app.use(areasRouter);
    app.use(customTypesRouter);
    app.use(notesRouter);
    app.use(configRouter);
    app.use(filtersRouter);
    app.use(sharesRouter);
    app.use(invitationsRouter);
    app.use(notificationsRouter);

    app.use('/admin', adminUsersRouter);
    app.use('/admin', auditRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
