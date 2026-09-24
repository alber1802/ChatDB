import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import type {
    BusMessage,
    RealtimeBus,
    RemoteBatchMessage,
} from './realtime-bus.js';

// Servidor WebSocket de colaboración
// (docs/collaboration/03-realtime-synchronization.md). Solo DIFUNDE: las
// escrituras siguen entrando por POST /diagrams/:id/sync, que publica cada
// lote confirmado en el bus; aquí se reparte a los sockets de esa sala.

export type DiagramRole = 'owner' | 'editor' | 'viewer';

export interface RealtimeDeps {
    verifyToken(token: string): Promise<{ id: string; exp?: number }>;
    getAccess(
        userId: string,
        diagramId: string
    ): Promise<{ role: DiagramRole | null; version: number }>;
    /** Lotes con version > since, en orden; null si el hueco ya no está en el log. */
    getOpsSince(
        userId: string,
        diagramId: string,
        since: number
    ): Promise<RemoteBatchMessage[] | null>;
    bus: RealtimeBus;
    allowedOrigins: string[];
    authTimeoutMs?: number;
    heartbeatMs?: number;
    maxMessagesPerSecond?: number;
}

export const CLOSE = {
    unauthenticated: 4001,
    forbidden: 4003,
    diagramDeleted: 4004,
    badMessage: 4400,
    rateLimited: 4429,
    restart: 1012,
} as const;

const PATH = '/realtime';
const MAX_PAYLOAD_BYTES = 16 * 1024;
const MAX_BUFFERED_BYTES = 1024 * 1024;

const clientMessageSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('auth'), token: z.string().min(1).max(4096) }),
    z.object({
        type: z.literal('join'),
        diagramId: z.string().min(1).max(100),
        sinceVersion: z.number().int().nonnegative(),
    }),
    z.object({ type: z.literal('leave') }),
    z.object({ type: z.literal('ping') }),
]);

interface Client {
    socket: WebSocket;
    userId?: string;
    tokenExp?: number;
    diagramId?: string;
    role?: DiagramRole;
    alive: boolean;
    tokens: number;
    overLimitSince?: number;
    authTimer?: ReturnType<typeof setTimeout>;
}

interface Room {
    clients: Set<Client>;
    unsubscribe: () => void;
}

export function attachRealtime(server: Server, deps: RealtimeDeps) {
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: MAX_PAYLOAD_BYTES,
    });
    const rooms = new Map<string, Room>();
    const clients = new Set<Client>();
    const authTimeoutMs = deps.authTimeoutMs ?? 5000;
    const heartbeatMs = deps.heartbeatMs ?? 25_000;
    const maxPerSecond = deps.maxMessagesPerSecond ?? 20;

    const send = (client: Client, message: unknown) => {
        if (client.socket.readyState !== WebSocket.OPEN) return;
        // Un cliente que no consume (pestaña congelada, red lenta) no puede
        // acumular memoria sin límite: se corta y al volver hará resync.
        if (client.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
            client.socket.terminate();
            return;
        }
        client.socket.send(JSON.stringify(message));
    };

    const leaveRoom = (client: Client) => {
        const diagramId = client.diagramId;
        if (!diagramId) return;
        client.diagramId = undefined;
        client.role = undefined;
        const room = rooms.get(diagramId);
        if (!room) return;
        room.clients.delete(client);
        if (room.clients.size === 0) {
            room.unsubscribe();
            rooms.delete(diagramId);
        }
    };

    const onBusMessage = (diagramId: string, message: BusMessage) => {
        const room = rooms.get(diagramId);
        if (!room) return;
        if (message.type === 'ops') {
            for (const client of room.clients) send(client, message);
            return;
        }
        if (message.type === 'diagram_deleted') {
            for (const client of [...room.clients]) {
                send(client, { type: 'diagram_deleted', diagramId });
                leaveRoom(client);
                client.socket.close(CLOSE.diagramDeleted, 'diagram deleted');
            }
            return;
        }
        // access_changed: se vuelve a consultar el rol de ese usuario.
        const affected = [...room.clients].filter(
            (c) => c.userId === message.userId
        );
        if (affected.length === 0) return;
        void deps
            .getAccess(message.userId, diagramId)
            .then(({ role }) => {
                for (const client of affected) {
                    if (client.diagramId !== diagramId) continue;
                    send(client, { type: 'access', diagramId, role });
                    if (!role) {
                        leaveRoom(client);
                        client.socket.close(CLOSE.forbidden, 'access revoked');
                    } else {
                        client.role = role;
                    }
                }
            })
            .catch((err) =>
                logger.error(
                    { err, diagramId },
                    'Realtime access re-check failed'
                )
            );
    };

    const joinRoom = async (
        client: Client,
        diagramId: string,
        sinceVersion: number
    ) => {
        const { role, version } = await deps.getAccess(
            client.userId!,
            diagramId
        );
        if (!role) {
            client.socket.close(CLOSE.forbidden, 'no access');
            return;
        }
        leaveRoom(client);
        let room = rooms.get(diagramId);
        if (!room) {
            room = {
                clients: new Set(),
                unsubscribe: deps.bus.subscribe(diagramId, (m) =>
                    onBusMessage(diagramId, m)
                ),
            };
            rooms.set(diagramId, room);
        }
        // Se entra a la sala ANTES de pedir el hueco: un lote publicado
        // mientras tanto llega igual (el cliente descarta duplicados por versión).
        room.clients.add(client);
        client.diagramId = diagramId;
        client.role = role;
        send(client, { type: 'joined', diagramId, role, version });

        if (sinceVersion >= version) return;
        const missed = await deps.getOpsSince(
            client.userId!,
            diagramId,
            sinceVersion
        );
        const contiguous =
            missed !== null &&
            missed.length > 0 &&
            missed[0].version === sinceVersion + 1;
        if (!contiguous) {
            send(client, { type: 'resync', diagramId });
            return;
        }
        for (const batch of missed) send(client, batch);
    };

    /** Token bucket por socket; exceso sostenido 10 s → cierre. */
    const allowMessage = (client: Client) => {
        if (client.tokens > 0) {
            client.tokens -= 1;
            client.overLimitSince = undefined;
            return true;
        }
        client.overLimitSince ??= Date.now();
        if (Date.now() - client.overLimitSince > 10_000) {
            client.socket.close(CLOSE.rateLimited, 'rate limited');
        }
        return false;
    };

    const onMessage = async (client: Client, raw: RawData) => {
        if (!allowMessage(client)) return;
        let message: z.infer<typeof clientMessageSchema>;
        try {
            message = clientMessageSchema.parse(JSON.parse(String(raw)));
        } catch {
            client.socket.close(CLOSE.badMessage, 'bad message');
            return;
        }

        if (message.type === 'auth') {
            try {
                const user = await deps.verifyToken(message.token);
                // Un socket no puede cambiar de usuario (sí renovar su token).
                if (client.userId && client.userId !== user.id) {
                    client.socket.close(CLOSE.unauthenticated, 'user mismatch');
                    return;
                }
                client.userId = user.id;
                client.tokenExp = user.exp;
                clearTimeout(client.authTimer);
                send(client, { type: 'authed' });
            } catch {
                client.socket.close(CLOSE.unauthenticated, 'invalid token');
            }
            return;
        }
        if (!client.userId) {
            client.socket.close(CLOSE.unauthenticated, 'not authenticated');
            return;
        }
        if (message.type === 'join') {
            try {
                await joinRoom(client, message.diagramId, message.sinceVersion);
            } catch (err) {
                logger.error({ err }, 'Realtime join failed');
                client.socket.close(1011, 'join failed');
            }
            return;
        }
        if (message.type === 'leave') {
            leaveRoom(client);
            return;
        }
        send(client, { type: 'pong' });
    };

    const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== PATH) return;
        const origin = req.headers.origin ?? '';
        if (!deps.allowedOrigins.includes(origin)) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
            const client: Client = {
                socket: ws,
                alive: true,
                tokens: maxPerSecond * 2,
            };
            clients.add(client);
            client.authTimer = setTimeout(() => {
                if (!client.userId) {
                    ws.close(CLOSE.unauthenticated, 'auth timeout');
                }
            }, authTimeoutMs);
            ws.on('pong', () => (client.alive = true));
            ws.on('message', (raw) => void onMessage(client, raw));
            ws.on('close', () => {
                clearTimeout(client.authTimer);
                leaveRoom(client);
                clients.delete(client);
            });
            ws.on('error', (err) =>
                logger.warn({ err }, 'Realtime socket error')
            );
        });
    };
    server.on('upgrade', onUpgrade);

    // Heartbeat (Heroku corta conexiones inactivas a los 55 s), recarga del
    // token bucket y corte de sockets con el token vencido.
    const refill = setInterval(() => {
        for (const client of clients) {
            client.tokens = Math.min(
                client.tokens + maxPerSecond,
                maxPerSecond * 2
            );
        }
    }, 1000);
    const heartbeat = setInterval(() => {
        const now = Date.now() / 1000;
        for (const client of clients) {
            if (!client.alive) {
                client.socket.terminate();
                continue;
            }
            if (client.tokenExp && client.tokenExp < now) {
                client.socket.close(CLOSE.unauthenticated, 'token expired');
                continue;
            }
            client.alive = false;
            client.socket.ping();
        }
    }, heartbeatMs);
    refill.unref();
    heartbeat.unref();

    return {
        /** Métricas básicas para /health y logs. */
        stats: () => ({ connections: clients.size, rooms: rooms.size }),
        close(code: number = CLOSE.restart) {
            clearInterval(refill);
            clearInterval(heartbeat);
            server.off('upgrade', onUpgrade);
            for (const client of clients)
                client.socket.close(code, 'server closing');
            for (const room of rooms.values()) room.unsubscribe();
            rooms.clear();
            wss.close();
        },
    };
}
