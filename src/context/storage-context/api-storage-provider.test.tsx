import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ApiStorageProvider } from './api-storage-provider';
import { useStorage } from '@/hooks/use-storage';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { apiFetch } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', async () => {
    const actual =
        await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
    return { ...actual, apiFetch: vi.fn() };
});

// Imperative handle so the test can drive `getDiagram` directly, the same
// way the real editor does on load (before the user can reach any update
// control) — without relying on effects + waitFor polling under fake timers.
type StorageHandle = ReturnType<typeof useStorage>;

function Probe({
    storageRef,
}: {
    storageRef: { current: StorageHandle | null };
}) {
    const storage = useStorage();
    const { status } = useSyncStatus();
    storageRef.current = storage;
    return (
        <button
            data-status={status}
            onClick={() =>
                storage.updateTable({
                    id: 't1',
                    attributes: { name: 'renamed' },
                })
            }
        >
            update
        </button>
    );
}

describe('ApiStorageProvider + SyncEngine wiring', () => {
    beforeEach(() => {
        vi.mocked(apiFetch).mockReset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not call apiFetch synchronously on updateTable; batches after debounce', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.startsWith('/diagrams/') && path.endsWith('/sync')) {
                return { version: 2, conflicts: [] };
            }
            if (path.startsWith('/diagrams/')) {
                return { id: 'd1', version: 1, name: 'x' };
            }
            return undefined;
        });

        const storageRef: { current: StorageHandle | null } = { current: null };
        render(
            <ApiStorageProvider>
                <Probe storageRef={storageRef} />
            </ApiStorageProvider>
        );

        // Mirrors the real app: the editor loads the diagram (which primes the
        // SyncEngine via ensureEngine) before the user can trigger any edit.
        await act(async () => {
            await storageRef.current!.getDiagram('d1');
        });

        const button = screen.getByRole('button');
        act(() => {
            button.click();
        });

        expect(
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
        ).toHaveLength(0);

        // advanceTimersByTimeAsync flushes both the debounce timer and the
        // microtasks created by the mocked apiFetch call it triggers, so the
        // /sync request has already completed by the time this resolves.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });

        expect(
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
        ).toHaveLength(1);
    });

    it('flushes the outgoing diagram before switching engines on getDiagram', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.startsWith('/diagrams/') && path.endsWith('/sync')) {
                return { version: 2, conflicts: [] };
            }
            if (path === '/diagrams/d1') {
                return { id: 'd1', version: 1, name: 'x' };
            }
            if (path === '/diagrams/d2') {
                return { id: 'd2', version: 1, name: 'y' };
            }
            return undefined;
        });

        const storageRef: { current: StorageHandle | null } = { current: null };
        render(
            <ApiStorageProvider>
                <Probe storageRef={storageRef} />
            </ApiStorageProvider>
        );

        await act(async () => {
            await storageRef.current!.getDiagram('d1');
        });

        const button = screen.getByRole('button');
        act(() => {
            button.click(); // queues an update for t1 on d1's (still pending) engine
        });

        // Well within the 700ms debounce window — nothing has been sent yet.
        expect(
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
        ).toHaveLength(0);

        // Switching to a different diagram must flush d1's pending edit
        // before the engine for d1 is torn down, rather than silently
        // dropping it (only recoverable later via the localStorage-restored
        // queue, with no flush scheduled until the next edit on d1).
        await act(async () => {
            await storageRef.current!.getDiagram('d2');
        });

        const syncCalls = vi
            .mocked(apiFetch)
            .mock.calls.filter(([p]) => p.includes('/sync'));
        expect(syncCalls).toHaveLength(1);
        expect(syncCalls[0][0]).toBe('/diagrams/d1/sync');
        const body = JSON.parse(
            (syncCalls[0][1] as RequestInit).body as string
        );
        expect(body.operations).toEqual([
            {
                entity: 'table',
                op: 'update',
                id: 't1',
                patch: { name: 'renamed' },
            },
        ]);
    });
});
