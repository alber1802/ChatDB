import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import {
    attachRealtime,
    type RealtimeDeps,
} from '../src/modules/realtime/realtime-server.ts';
import { createMemoryBus } from '../src/modules/realtime/realtime-bus.ts';

const ORIGIN = 'http://localhost:5173';

interface Harness {
    url: string;
    deps: RealtimeDeps;
    close: () => Promise<void>;
}

const servers: Harness[] = [];

async function startServer(
    overrides: Partial<RealtimeDeps> = {}
): Promise<Harness> {
    const server = http.createServer();
    const deps: RealtimeDeps = {
        verifyToken: async (token) => {
            if (!token.startsWith('valid-')) throw new Error('bad token');
            return { id: token.slice('valid-'.length) };
        },
        getAccess: async (userId, diagramId) =>
            diagramId === 'd1' && userId !== 'stranger'
                ? {
                      role: userId === 'viewer' ? 'viewer' : 'editor',
                      version: 5,
                  }
                : { role: null, version: 0 },
        getOpsSince: async () => [],
        bus: createMemoryBus(),
        allowedOrigins: [ORIGIN],
        authTimeoutMs: 200,
        heartbeatMs: 10_000,
        ...overrides,
    };
    const realtime = attachRealtime(server, deps);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const harness = {
        url: `ws://127.0.0.1:${port}/realtime`,
        deps,
        close: async () => {
            realtime.close();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
    servers.push(harness);
    return harness;
}

afterEach(async () => {
    while (servers.length) await servers.pop()!.close();
});

/** Cliente de prueba que acumula mensajes y el código de cierre. */
function connect(url: string, origin = ORIGIN) {
    const ws = new WebSocket(url, { origin });
    const messages: Record<string, unknown>[] = [];
    const waiters: Array<() => void> = [];
    let closeCode: number | undefined;
    ws.on('message', (data) => {
        messages.push(JSON.parse(String(data)));
        waiters.splice(0).forEach((w) => w());
    });
    ws.on('close', (code) => {
        closeCode = code;
        waiters.splice(0).forEach((w) => w());
    });
    const opened = new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
    });
    const until = async (predicate: () => boolean, timeoutMs = 2000) => {
        const start = Date.now();
        while (!predicate()) {
            if (Date.now() - start > timeoutMs) throw new Error('timeout');
            await new Promise<void>((resolve) => {
                waiters.push(resolve);
                setTimeout(resolve, 50);
            });
        }
    };
    return {
        ws,
        opened,
        messages,
        send: (msg: unknown) => ws.send(JSON.stringify(msg)),
        closeCode: () => closeCode,
        waitFor: (type: string) =>
            until(() => messages.some((m) => m.type === type)).then(() =>
                messages.find((m) => m.type === type)!
            ),
        waitClose: () =>
            until(() => closeCode !== undefined).then(() => closeCode),
    };
}

async function joined(url: string, user = 'u1', sinceVersion = 5) {
    const client = connect(url);
    await client.opened;
    client.send({ type: 'auth', token: `valid-${user}` });
    await client.waitFor('authed');
    client.send({ type: 'join', diagramId: 'd1', sinceVersion });
    await client.waitFor('joined');
    return client;
}

describe('realtime WebSocket server', () => {
    it('rejects upgrades from an origin that is not allowed', async () => {
        const { url } = await startServer();
        const client = connect(url, 'https://evil.example');
        await expect(client.opened).rejects.toThrow();
    });

    it('closes with 4001 when the client does not authenticate in time', async () => {
        const { url } = await startServer();
        const client = connect(url);
        await client.opened;
        expect(await client.waitClose()).toBe(4001);
    });

    it('closes with 4001 on an invalid token', async () => {
        const { url } = await startServer();
        const client = connect(url);
        await client.opened;
        client.send({ type: 'auth', token: 'forged' });
        expect(await client.waitClose()).toBe(4001);
    });

    it('closes with 4400 on a malformed message', async () => {
        const { url } = await startServer();
        const client = connect(url);
        await client.opened;
        client.ws.send('not json');
        expect(await client.waitClose()).toBe(4400);
    });

    it('refuses to join a diagram without access (4003)', async () => {
        const { url } = await startServer();
        const client = connect(url);
        await client.opened;
        client.send({ type: 'auth', token: 'valid-stranger' });
        await client.waitFor('authed');
        client.send({ type: 'join', diagramId: 'd1', sinceVersion: 0 });
        expect(await client.waitClose()).toBe(4003);
    });

    it('joins with the role and current version, then receives published batches', async () => {
        const { url, deps } = await startServer();
        const client = await joined(url);
        expect(client.messages.find((m) => m.type === 'joined')).toMatchObject({
            diagramId: 'd1',
            role: 'editor',
            version: 5,
        });

        deps.bus.publish('d1', {
            type: 'ops',
            diagramId: 'd1',
            version: 6,
            batchId: 'b6',
            sessionId: 's-other',
            userId: 'u2',
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ],
        });
        expect(await client.waitFor('ops')).toMatchObject({
            version: 6,
            batchId: 'b6',
        });
    });

    it('does not deliver batches of other diagrams', async () => {
        const { url, deps } = await startServer();
        const client = await joined(url);
        deps.bus.publish('d2', {
            type: 'ops',
            diagramId: 'd2',
            version: 1,
            batchId: 'x',
            sessionId: 's',
            userId: 'u2',
            operations: [],
        });
        await new Promise((r) => setTimeout(r, 100));
        expect(client.messages.some((m) => m.type === 'ops')).toBe(false);
    });

    it('sends the missed batches when rejoining behind the current version', async () => {
        const { url } = await startServer({
            getOpsSince: async (_u, _d, since) =>
                since === 3
                    ? [
                          {
                              type: 'ops',
                              diagramId: 'd1',
                              version: 4,
                              batchId: 'b4',
                              sessionId: 's',
                              userId: 'u2',
                              operations: [],
                          },
                          {
                              type: 'ops',
                              diagramId: 'd1',
                              version: 5,
                              batchId: 'b5',
                              sessionId: 's',
                              userId: 'u2',
                              operations: [],
                          },
                      ]
                    : null,
        });
        const client = await joined(url, 'u1', 3);
        await client.waitFor('ops');
        await new Promise((r) => setTimeout(r, 50));
        expect(
            client.messages
                .filter((m) => m.type === 'ops')
                .map((m) => m.version)
        ).toEqual([4, 5]);
    });

    it('asks for a full resync when the gap is no longer in the log', async () => {
        const { url } = await startServer({ getOpsSince: async () => null });
        const client = await joined(url, 'u1', 1);
        expect(await client.waitFor('resync')).toMatchObject({
            diagramId: 'd1',
        });
    });

    it('kicks a member whose access was revoked (4003)', async () => {
        let revoked = false;
        const { url, deps } = await startServer({
            getAccess: async () =>
                revoked
                    ? { role: null, version: 5 }
                    : { role: 'editor', version: 5 },
        });
        const client = await joined(url, 'u2');
        revoked = true;
        deps.bus.publish('d1', {
            type: 'access_changed',
            diagramId: 'd1',
            userId: 'u2',
        });
        expect(await client.waitFor('access')).toMatchObject({ role: null });
        expect(await client.waitClose()).toBe(4003);
    });

    it('tells a member about a role change without disconnecting', async () => {
        let role: 'editor' | 'viewer' = 'editor';
        const { url, deps } = await startServer({
            getAccess: async () => ({ role, version: 5 }),
        });
        const client = await joined(url, 'u2');
        role = 'viewer';
        deps.bus.publish('d1', {
            type: 'access_changed',
            diagramId: 'd1',
            userId: 'u2',
        });
        expect(await client.waitFor('access')).toMatchObject({
            role: 'viewer',
        });
        expect(client.closeCode()).toBeUndefined();
    });

    it('closes rooms when the diagram is deleted (4004)', async () => {
        const { url, deps } = await startServer();
        const client = await joined(url);
        deps.bus.publish('d1', { type: 'diagram_deleted', diagramId: 'd1' });
        expect(await client.waitClose()).toBe(4004);
    });
});
