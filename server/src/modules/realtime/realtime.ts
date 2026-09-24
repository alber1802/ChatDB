import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { withUserContext } from '../../config/db.js';
import { verifyAccessToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { ACCESS_ROLE_SQL } from '../diagrams/diagrams.service.js';
import type { SyncOperation } from '../sync/sync.service.js';
import {
    createMemoryBus,
    createRedisBus,
    type BusMessage,
    type RealtimeBus,
    type RemoteBatchMessage,
} from './realtime-bus.js';
import {
    attachRealtime,
    type DiagramRole,
    type RealtimeDeps,
} from './realtime-server.js';

// Punto de entrada del tiempo real para el resto del backend: el bus
// (memoria o Redis según REDIS_URL) y helpers para publicar desde las rutas.

let bus: RealtimeBus | null = null;

export function getRealtimeBus(): RealtimeBus {
    if (!bus) {
        bus = env.REDIS_URL ? createRedisBus(env.REDIS_URL) : createMemoryBus();
    }
    return bus;
}

/** Publica tras el COMMIT; un fallo de publicación nunca rompe la escritura. */
function publish(diagramId: string, message: BusMessage) {
    if (!env.REALTIME_ENABLED) return;
    try {
        getRealtimeBus().publish(diagramId, message);
    } catch (err) {
        logger.error({ err, diagramId }, 'Realtime publish failed');
    }
}

export const realtime = {
    publishBatch(params: {
        diagramId: string;
        version: number;
        batchId?: string;
        sessionId?: string;
        userId: string;
        operations: SyncOperation[];
    }) {
        if (params.operations.length === 0) return;
        publish(params.diagramId, {
            type: 'ops',
            diagramId: params.diagramId,
            version: params.version,
            batchId: params.batchId ?? randomUUID(),
            sessionId: params.sessionId ?? null,
            userId: params.userId,
            operations: params.operations,
        });
    },
    accessChanged(diagramId: string, userId: string) {
        publish(diagramId, { type: 'access_changed', diagramId, userId });
    },
    diagramDeleted(diagramId: string) {
        publish(diagramId, { type: 'diagram_deleted', diagramId });
    },
};

const deps = (): RealtimeDeps => ({
    verifyToken: verifyAccessToken,
    getAccess: (userId, diagramId) =>
        withUserContext(userId, async (client) => {
            const { rows } = await client.query(
                `SELECT ${ACCESS_ROLE_SQL} AS access_role, d.version
                 FROM diagrams d WHERE d.id = $1`,
                [diagramId]
            );
            return {
                role: (rows[0]?.access_role as DiagramRole | null) ?? null,
                version: Number(rows[0]?.version ?? 0),
            };
        }),
    getOpsSince: (userId, diagramId, since) =>
        withUserContext(userId, async (client) => {
            const { rows: exists } = await client.query(
                `SELECT to_regclass('public.diagram_ops') IS NOT NULL AS available`
            );
            if (!exists[0]?.available) return null;
            const { rows } = await client.query(
                `SELECT version, batch_id, session_id, user_id, operations
                 FROM diagram_ops
                 WHERE diagram_id = $1 AND version > $2
                 ORDER BY version
                 LIMIT 500`,
                [diagramId, since]
            );
            if (rows.length === 0) return null;
            return rows.map((r): RemoteBatchMessage => ({
                type: 'ops',
                diagramId,
                version: Number(r.version),
                batchId: String(r.batch_id),
                sessionId: (r.session_id as string) ?? null,
                userId: String(r.user_id),
                operations: r.operations as unknown[],
            }));
        }),
    bus: getRealtimeBus(),
    allowedOrigins: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
});

export function startRealtime(server: Server) {
    if (!env.REALTIME_ENABLED) {
        logger.info('Realtime disabled (REALTIME_ENABLED=false)');
        return null;
    }
    const handle = attachRealtime(server, deps());
    logger.info(
        { bus: env.REDIS_URL ? 'redis' : 'memory' },
        'Realtime WebSocket listening on /realtime'
    );
    return handle;
}
