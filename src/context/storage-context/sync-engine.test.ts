import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine, collapseOperations } from './sync-engine';
import { ApiError, apiFetch } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', async () => {
    const actual =
        await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
    return { ...actual, apiFetch: vi.fn() };
});

const QUEUE_KEY = 'chartdb:sync-queue:d1';
const INFLIGHT_KEY = 'chartdb:sync-inflight:d1';

describe('collapseOperations', () => {
    it('merges patches for the same entity', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'table', op: 'update', id: 't1', patch: { y: 2 } },
        ]);
        expect(result).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1, y: 2 } },
        ]);
    });
});

describe('SyncEngine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(apiFetch).mockReset();
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('groups operations queued within the debounce window into one request', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { y: 2 },
        });
        engine.enqueue({
            entity: 'area',
            op: 'create',
            id: 'a1',
            patch: { x: 0, y: 0, width: 10, height: 10, color: '#fff' },
        });

        await vi.advanceTimersByTimeAsync(700);

        expect(apiFetch).toHaveBeenCalledTimes(1);
        const [path, init] = vi.mocked(apiFetch).mock.calls[0];
        expect(path).toBe('/diagrams/d1/sync');
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.baseVersion).toBe(1);
        expect(body.operations).toHaveLength(2);
        engine.destroy();
    });

    it('retries with backoff and eventually reports an error', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
        const onStatusChange = vi.fn();
        const engine = new SyncEngine({
            diagramId: 'd1',
            initialVersion: 1,
            maxRetries: 2,
            onStatusChange,
        });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700); // primer intento falla
        await vi.advanceTimersByTimeAsync(1000); // reintento 1 falla
        await vi.advanceTimersByTimeAsync(2000); // reintento 2 falla -> error

        expect(onStatusChange).toHaveBeenCalledWith('error', 'network down');
        engine.destroy();
    });

    it('silences status/conflict notifications once destroyed, without dropping the in-flight send', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        const onStatusChange = vi.fn();
        const engine = new SyncEngine({
            diagramId: 'd1',
            initialVersion: 1,
            onStatusChange,
        });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });

        // Start the send directly (mirrors ApiStorageProvider.ensureEngine's
        // fire-and-forget `flushNow()` right before switching diagrams).
        // flushNow() runs synchronously up to its first `await`, which is
        // enough to invoke the 'saving' notification before we destroy.
        const pending = engine.flushNow();
        expect(onStatusChange.mock.calls[0][0]).toBe('saving');
        const callsBeforeDestroy = onStatusChange.mock.calls.length;

        engine.destroy();

        // Let the in-flight apiFetch call resolve. Without the destroyed
        // guard this would call onStatusChange('saved') on a callback that
        // may since have been repurposed for a different diagram.
        await pending;

        expect(apiFetch).toHaveBeenCalledTimes(1); // the send itself still happened
        expect(onStatusChange).toHaveBeenCalledTimes(callsBeforeDestroy);
    });

    // ─── I4: a queue restored from localStorage must flush on its own ────
    it('schedules a flush for a queue restored from localStorage, without waiting for a new edit', async () => {
        localStorage.setItem(
            QUEUE_KEY,
            JSON.stringify([
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ])
        );
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });

        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });
        expect(apiFetch).not.toHaveBeenCalled(); // debounce, not an immediate send

        await vi.advanceTimersByTimeAsync(700);

        expect(apiFetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(
            (vi.mocked(apiFetch).mock.calls[0][1] as RequestInit).body as string
        );
        expect(body.operations).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
        ]);
        engine.destroy();
    });

    // ─── I5.1: max-wait cap on the debounce ──────────────────────────────
    it('caps the debounce: a continuous edit stream still flushes after the max wait', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        // An edit every 500ms: always inside the 700ms debounce window, so
        // the debounce timer alone would be reset forever and never fire.
        for (let i = 0; i < 10; i++) {
            engine.enqueue({
                entity: 'table',
                op: 'update',
                id: `t${i}`,
                patch: { x: i },
            });
            await vi.advanceTimersByTimeAsync(500);
        }

        expect(apiFetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(
            (vi.mocked(apiFetch).mock.calls[0][1] as RequestInit).body as string
        );
        // Everything queued up to the moment the cap tripped (t = 4000ms).
        expect(body.operations).toHaveLength(9);
        engine.destroy();
    });

    // ─── I5.2: the retry timer must be tracked and cancellable ───────────
    it('cancels a scheduled retry on destroy', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700); // first attempt fails, retry armed at +1000
        expect(apiFetch).toHaveBeenCalledTimes(1);

        engine.destroy();
        await vi.advanceTimersByTimeAsync(20000);

        // The untracked retry timer used to survive destroy() and fire anyway.
        expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it('cancels a scheduled retry when flushNow is invoked directly', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700); // attempt 1 fails, retry armed at +1000
        expect(apiFetch).toHaveBeenCalledTimes(1);

        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        await engine.flushNow(); // manual flush supersedes the armed retry
        expect(apiFetch).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(20000);
        expect(apiFetch).toHaveBeenCalledTimes(2); // the stale retry never fired
        engine.destroy();
    });

    // ─── I3: the in-flight batch must survive an unload / crash ──────────
    it('sends the batch with keepalive so it survives tab unload', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700);

        const init = vi.mocked(apiFetch).mock.calls[0][1] as RequestInit;
        expect(init.keepalive).toBe(true);
        engine.destroy();
    });

    it('drops keepalive for a batch over the 64 KiB keepalive body limit', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        // A realistic large import: the browser rejects a keepalive request
        // whose body exceeds 64 KiB, so such a batch must go out without it
        // (it stays protected by the in-flight localStorage copy instead).
        engine.enqueue({
            entity: 'table',
            op: 'create',
            id: 't1',
            patch: { name: 'x'.repeat(80_000) },
        });
        await vi.advanceTimersByTimeAsync(700);

        const init = vi.mocked(apiFetch).mock.calls[0][1] as RequestInit;
        expect(init.keepalive).toBe(false);
        expect(
            JSON.parse(init.body as string).operations[0].patch.name
        ).toHaveLength(80_000);
        engine.destroy();
    });

    it('keeps the in-flight batch persisted until the request succeeds', async () => {
        let settle: (value: {
            version: number;
            conflicts: [];
        }) => void = () => {};
        vi.mocked(apiFetch).mockImplementation(
            () =>
                new Promise((resolve) => {
                    settle = resolve as typeof settle;
                }) as never
        );
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700);

        // The main queue key is already cleared, but the batch is not lost:
        // it lives under the in-flight key until the server confirms it.
        expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
        expect(
            JSON.parse(localStorage.getItem(INFLIGHT_KEY) as string)
        ).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
        ]);

        settle({ version: 2, conflicts: [] });
        await vi.advanceTimersByTimeAsync(0);

        expect(localStorage.getItem(INFLIGHT_KEY)).toBeNull();
        engine.destroy();
    });

    it('recovers an in-flight batch left behind by a crashed session', async () => {
        // The previous session died with this batch mid-flight.
        localStorage.setItem(
            INFLIGHT_KEY,
            JSON.stringify([
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ])
        );
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });

        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });
        await vi.advanceTimersByTimeAsync(700);

        expect(apiFetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(
            (vi.mocked(apiFetch).mock.calls[0][1] as RequestInit).body as string
        );
        expect(body.operations).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
        ]);
        expect(localStorage.getItem(INFLIGHT_KEY)).toBeNull();
        engine.destroy();
    });

    it('merges a recovered in-flight batch under a newer restored queue entry', async () => {
        localStorage.setItem(
            INFLIGHT_KEY,
            JSON.stringify([
                {
                    entity: 'table',
                    op: 'update',
                    id: 't1',
                    patch: { x: 1, y: 1 },
                },
            ])
        );
        localStorage.setItem(
            QUEUE_KEY,
            JSON.stringify([
                { entity: 'table', op: 'update', id: 't1', patch: { y: 2 } },
            ])
        );
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });

        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });
        await vi.advanceTimersByTimeAsync(700);

        const body = JSON.parse(
            (vi.mocked(apiFetch).mock.calls[0][1] as RequestInit).body as string
        );
        // The queued (newer) value wins over the in-flight (older) one.
        expect(body.operations).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1, y: 2 } },
        ]);
        engine.destroy();
    });

    // ─── I7: deleteDiagram support — wipe every persisted trace ──────────
    it('clearPersistedQueue removes both the queue and the in-flight keys', async () => {
        let settle: (value: {
            version: number;
            conflicts: [];
        }) => void = () => {};
        vi.mocked(apiFetch).mockImplementation(
            () =>
                new Promise((resolve) => {
                    settle = resolve as typeof settle;
                }) as never
        );
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });
        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700);
        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't2',
            patch: { x: 2 },
        });
        expect(localStorage.getItem(QUEUE_KEY)).not.toBeNull();
        expect(localStorage.getItem(INFLIGHT_KEY)).not.toBeNull();

        engine.clearPersistedQueue();

        expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
        expect(localStorage.getItem(INFLIGHT_KEY)).toBeNull();
        settle({ version: 2, conflicts: [] });
        engine.destroy();
    });

    // ─── M10: 'offline' is for connectivity loss, not server errors ──────
    it('reports a retryable server error as "error", not "offline"', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new ApiError('boom', 500));
        const onStatusChange = vi.fn();
        const engine = new SyncEngine({
            diagramId: 'd1',
            initialVersion: 1,
            maxRetries: 5,
            onStatusChange,
        });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700);

        expect(onStatusChange).toHaveBeenCalledWith('error', undefined);
        expect(onStatusChange).not.toHaveBeenCalledWith('offline', undefined);
        engine.destroy();
    });

    it('still reports a genuine network failure as "offline" while retrying', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new TypeError('Failed to fetch'));
        const onStatusChange = vi.fn();
        const engine = new SyncEngine({
            diagramId: 'd1',
            initialVersion: 1,
            maxRetries: 5,
            onStatusChange,
        });

        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 1 },
        });
        await vi.advanceTimersByTimeAsync(700);

        expect(onStatusChange).toHaveBeenCalledWith('offline', undefined);
        engine.destroy();
    });
});
