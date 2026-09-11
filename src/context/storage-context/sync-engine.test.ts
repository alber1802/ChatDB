import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine, collapseOperations } from './sync-engine';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
    apiFetch: vi.fn(),
}));

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

    it('exposes a pending patch via peek before it is flushed', () => {
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });
        engine.enqueue({
            entity: 'table',
            op: 'update',
            id: 't1',
            patch: { x: 5 },
        });
        expect(engine.peek('table', 't1')).toEqual({ x: 5 });
        expect(engine.peek('table', 'unknown')).toBeNull();
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
});
