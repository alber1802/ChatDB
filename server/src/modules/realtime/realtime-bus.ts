import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import { logger } from '../../lib/logger.js';

// Mensajes que circulan entre instancias del API por canal de diagrama
// (docs/collaboration/03-realtime-synchronization.md).

export interface RemoteBatchMessage {
    type: 'ops';
    diagramId: string;
    version: number;
    batchId: string;
    sessionId: string | null;
    userId: string;
    operations: unknown[];
}

export type BusMessage =
    | RemoteBatchMessage
    /** Cambió el rol o se revocó el acceso de un usuario a este diagrama. */
    | { type: 'access_changed'; diagramId: string; userId: string }
    | { type: 'diagram_deleted'; diagramId: string };

export interface RealtimeBus {
    publish(diagramId: string, message: BusMessage): void;
    /** Devuelve la función para cancelar la suscripción. */
    subscribe(diagramId: string, handler: (m: BusMessage) => void): () => void;
    close(): Promise<void>;
}

const channel = (diagramId: string) => `chartdb:diagram:${diagramId}`;

/** Una sola instancia del API: basta un EventEmitter. */
export function createMemoryBus(): RealtimeBus {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    return {
        publish(diagramId, message) {
            emitter.emit(channel(diagramId), message);
        },
        subscribe(diagramId, handler) {
            emitter.on(channel(diagramId), handler);
            return () => emitter.off(channel(diagramId), handler);
        },
        async close() {
            emitter.removeAllListeners();
        },
    };
}

/**
 * Varias instancias (dynos): Redis pub/sub. Se necesitan dos conexiones
 * porque una conexión en modo subscribe no puede publicar. No se usa
 * LISTEN/NOTIFY de Postgres: el pooler de Supabase en modo transacción no lo
 * soporta.
 */
export function createRedisBus(redisUrl: string): RealtimeBus {
    const pub = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
    const sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const local = createMemoryBus();
    const counts = new Map<string, number>();

    for (const client of [pub, sub]) {
        client.on('error', (err: Error) =>
            logger.error({ err }, 'Realtime Redis error')
        );
    }
    sub.on('message', (ch: string, raw: string) => {
        try {
            const message = JSON.parse(raw) as BusMessage;
            local.publish(message.diagramId, message);
        } catch (err) {
            logger.warn({ err, ch }, 'Invalid realtime bus message');
        }
    });

    return {
        publish(diagramId, message) {
            pub.publish(channel(diagramId), JSON.stringify(message)).catch(
                (err: unknown) =>
                    logger.error({ err, diagramId }, 'Realtime publish failed')
            );
        },
        subscribe(diagramId, handler) {
            const ch = channel(diagramId);
            const count = counts.get(ch) ?? 0;
            if (count === 0) void sub.subscribe(ch);
            counts.set(ch, count + 1);
            const off = local.subscribe(diagramId, handler);
            return () => {
                off();
                const next = (counts.get(ch) ?? 1) - 1;
                if (next <= 0) {
                    counts.delete(ch);
                    void sub.unsubscribe(ch);
                } else {
                    counts.set(ch, next);
                }
            };
        },
        async close() {
            await Promise.allSettled([pub.quit(), sub.quit()]);
            await local.close();
        },
    };
}
