import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    RealtimeClient,
    type RealtimeClientOptions,
    type SocketLike,
} from '../realtime-client';

class FakeSocket implements SocketLike {
    static instances: FakeSocket[] = [];
    readyState = 0;
    sent: Record<string, unknown>[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: ((e: { code: number }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) {
        FakeSocket.instances.push(this);
    }
    send(data: string) {
        this.sent.push(JSON.parse(data));
    }
    close(code = 1000) {
        this.readyState = 3;
        this.onclose?.({ code });
    }
    // helpers de prueba
    open() {
        this.readyState = 1;
        this.onopen?.();
    }
    receive(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
    }
    serverClose(code: number) {
        this.readyState = 3;
        this.onclose?.({ code });
    }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];

function setup(overrides: Partial<RealtimeClientOptions> = {}) {
    const onBatch = vi.fn();
    const onStatus = vi.fn();
    const onResync = vi.fn();
    const onAccess = vi.fn();
    const onDeleted = vi.fn();
    const client = new RealtimeClient({
        url: 'ws://api/realtime',
        diagramId: 'd1',
        initialVersion: 5,
        sessionId: 'me',
        getToken: async () => 'tok',
        onBatch,
        onStatus,
        onResync,
        onAccess,
        onDeleted,
        createSocket: (url) => new FakeSocket(url),
        random: () => 0.5,
        ...overrides,
    });
    return { client, onBatch, onStatus, onResync, onAccess, onDeleted };
}

/** Conecta, autentica y entra a la sala. */
async function goLive() {
    const socket = last();
    socket.open();
    await vi.advanceTimersByTimeAsync(0);
    socket.receive({ type: 'authed' });
    socket.receive({
        type: 'joined',
        diagramId: 'd1',
        role: 'editor',
        version: 5,
    });
    return socket;
}

const batch = (
    version: number,
    sessionId = 'other',
    ops: unknown[] = [
        { entity: 'table', op: 'update', id: 't1', patch: { x: version } },
    ]
) => ({
    type: 'ops',
    diagramId: 'd1',
    version,
    batchId: `b${version}`,
    sessionId,
    userId: 'u2',
    operations: ops,
});

describe('RealtimeClient', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        FakeSocket.instances = [];
    });
    afterEach(() => vi.useRealTimers());

    it('authenticates with the first message and joins from the known version', async () => {
        const { client, onStatus } = setup();
        client.connect();
        const socket = last();
        socket.open();
        await vi.advanceTimersByTimeAsync(0);
        expect(socket.sent[0]).toEqual({ type: 'auth', token: 'tok' });
        socket.receive({ type: 'authed' });
        expect(socket.sent[1]).toEqual({
            type: 'join',
            diagramId: 'd1',
            sinceVersion: 5,
        });
        socket.receive({
            type: 'joined',
            diagramId: 'd1',
            role: 'editor',
            version: 5,
        });
        expect(onStatus).toHaveBeenLastCalledWith('live');
        client.destroy();
    });

    it('applies batches in version order and skips its own session', async () => {
        const { client, onBatch } = setup();
        client.connect();
        const socket = await goLive();
        socket.receive(batch(6));
        socket.receive(batch(7, 'me'));
        socket.receive(batch(8));
        expect(onBatch.mock.calls.map((c) => c[1].version)).toEqual([6, 8]);
        expect(client.version).toBe(8);
        client.destroy();
    });

    it('drops duplicates and buffers out-of-order batches until the gap fills', async () => {
        const { client, onBatch } = setup();
        client.connect();
        const socket = await goLive();
        socket.receive(batch(7));
        expect(onBatch).not.toHaveBeenCalled();
        socket.receive(batch(6));
        socket.receive(batch(6));
        expect(onBatch.mock.calls.map((c) => c[1].version)).toEqual([6, 7]);
        client.destroy();
    });

    it('asks the server again when a gap does not fill in time', async () => {
        const { client } = setup();
        client.connect();
        const socket = await goLive();
        socket.receive(batch(8));
        await vi.advanceTimersByTimeAsync(2000);
        expect(socket.sent.at(-1)).toEqual({
            type: 'join',
            diagramId: 'd1',
            sinceVersion: 5,
        });
        client.destroy();
    });

    it('reconnects with exponential backoff and rejoins from the last applied version', async () => {
        const { client, onStatus } = setup();
        client.connect();
        const first = await goLive();
        first.receive(batch(6));
        first.serverClose(1006);
        expect(onStatus).toHaveBeenLastCalledWith('reconnecting');

        await vi.advanceTimersByTimeAsync(499);
        expect(FakeSocket.instances).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        const second = last();
        expect(FakeSocket.instances).toHaveLength(2);

        second.open();
        await vi.advanceTimersByTimeAsync(0);
        second.receive({ type: 'authed' });
        expect(second.sent.at(-1)).toEqual({
            type: 'join',
            diagramId: 'd1',
            sinceVersion: 6,
        });

        // Un segundo corte sin haber llegado a "joined" dobla la espera.
        second.serverClose(1006);
        await vi.advanceTimersByTimeAsync(999);
        expect(FakeSocket.instances).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(FakeSocket.instances).toHaveLength(3);
        client.destroy();
    });

    it('stops reconnecting when access is revoked or the diagram is deleted', async () => {
        const { client, onAccess } = setup();
        client.connect();
        const socket = await goLive();
        socket.receive({ type: 'access', diagramId: 'd1', role: null });
        expect(onAccess).toHaveBeenCalledWith(null);
        socket.serverClose(4003);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(FakeSocket.instances).toHaveLength(1);
        client.destroy();
    });

    it('reports role changes and deletion', async () => {
        const { client, onAccess, onDeleted } = setup();
        client.connect();
        const socket = await goLive();
        socket.receive({ type: 'access', diagramId: 'd1', role: 'viewer' });
        socket.receive({ type: 'diagram_deleted', diagramId: 'd1' });
        expect(onAccess).toHaveBeenCalledWith('viewer');
        expect(onDeleted).toHaveBeenCalled();
        client.destroy();
    });

    it('forwards resync requests and restarts ordering from the reloaded version', async () => {
        const { client, onResync, onBatch } = setup();
        client.connect();
        const socket = await goLive();
        socket.receive({ type: 'resync', diagramId: 'd1' });
        expect(onResync).toHaveBeenCalled();
        client.resetVersion(20);
        socket.receive(batch(21));
        expect(onBatch).toHaveBeenCalledTimes(1);
        client.destroy();
    });

    it('does not reconnect after destroy', async () => {
        const { client } = setup();
        client.connect();
        await goLive();
        client.destroy();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(FakeSocket.instances).toHaveLength(1);
    });
});
