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
        localStorage.clear();
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

    // ─── C1: an empty diagram patch poisons the whole batch ──────────────
    describe('updateDiagram patch building', () => {
        const mockApi = () =>
            vi.mocked(apiFetch).mockImplementation(async (path: string) => {
                if (path.endsWith('/sync')) {
                    return { version: 2, conflicts: [] };
                }
                if (path.startsWith('/diagrams/')) {
                    return { id: 'd1', version: 1, name: 'x' };
                }
                return undefined;
            });

        const syncCalls = () =>
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'));

        it('enqueues nothing when only updatedAt changes (would send patch: {} and abort the whole batch)', async () => {
            mockApi();
            const storageRef: { current: StorageHandle | null } = {
                current: null,
            };
            render(
                <ApiStorageProvider>
                    <Probe storageRef={storageRef} />
                </ApiStorageProvider>
            );
            await act(async () => {
                await storageRef.current!.getDiagram('d1');
            });

            // This is what almost every chartdb-provider mutator sends.
            await act(async () => {
                await storageRef.current!.updateDiagram({
                    id: 'd1',
                    attributes: { updatedAt: new Date() },
                });
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(5000);
            });

            // `updatedAt` is applied server-side by /sync itself, so there is
            // nothing meaningful to send — and sending `patch: {}` would make
            // diagramPatchSchema throw and roll back the entire transaction.
            expect(syncCalls()).toHaveLength(0);
        });

        it('enqueues only the attributes that are actually defined', async () => {
            mockApi();
            const storageRef: { current: StorageHandle | null } = {
                current: null,
            };
            render(
                <ApiStorageProvider>
                    <Probe storageRef={storageRef} />
                </ApiStorageProvider>
            );
            await act(async () => {
                await storageRef.current!.getDiagram('d1');
            });

            await act(async () => {
                await storageRef.current!.updateDiagram({
                    id: 'd1',
                    attributes: { name: 'nuevo', updatedAt: new Date() },
                });
            });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(700);
            });

            const calls = syncCalls();
            expect(calls).toHaveLength(1);
            const body = JSON.parse(
                (calls[0][1] as RequestInit).body as string
            );
            expect(body.operations).toEqual([
                {
                    entity: 'diagram',
                    op: 'update',
                    id: 'd1',
                    patch: { name: 'nuevo' },
                },
            ]);
            // Whatever ends up on the wire, a diagram patch is never empty.
            for (const op of body.operations) {
                if (op.entity === 'diagram') {
                    expect(Object.keys(op.patch ?? {}).length).toBeGreaterThan(
                        0
                    );
                }
            }
        });
    });

    // ─── C2: read-your-own-writes ────────────────────────────────────────
    it('flushes pending writes before a single-entity read', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.endsWith('/sync')) return { version: 2, conflicts: [] };
            if (path === '/diagrams/d1/tables/t1') {
                return { id: 't1', name: 'renamed' };
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
        await act(async () => {
            await storageRef.current!.getDiagram('d1');
        });

        act(() => {
            screen.getByRole('button').click(); // queues an update for t1
        });
        // Still inside the debounce window: nothing sent yet.
        expect(
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
        ).toHaveLength(0);

        await act(async () => {
            await storageRef.current!.getTable({ diagramId: 'd1', id: 't1' });
        });

        const paths = vi.mocked(apiFetch).mock.calls.map(([p]) => p as string);
        const syncIndex = paths.indexOf('/diagrams/d1/sync');
        const readIndex = paths.indexOf('/diagrams/d1/tables/t1');
        expect(syncIndex).toBeGreaterThanOrEqual(0);
        // The queued write must reach the server BEFORE the read, or the
        // read-modify-write mutators in chartdb-provider would rewrite the
        // whole fields/indexes array from a stale copy.
        expect(syncIndex).toBeLessThan(readIndex);
    });

    // ─── M11: a queued upsert must not resurrect a bulk-deleted row ──────
    it('flushes pending writes before a bulk delete', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.endsWith('/sync')) return { version: 2, conflicts: [] };
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
        await act(async () => {
            await storageRef.current!.getDiagram('d1');
        });

        act(() => {
            screen.getByRole('button').click();
        });

        await act(async () => {
            await storageRef.current!.deleteDiagramTables('d1');
        });

        const paths = vi.mocked(apiFetch).mock.calls.map(([p]) => p as string);
        const syncIndex = paths.indexOf('/diagrams/d1/sync');
        const deleteIndex = paths.lastIndexOf('/diagrams/d1/tables');
        expect(syncIndex).toBeGreaterThanOrEqual(0);
        expect(syncIndex).toBeLessThan(deleteIndex);
    });

    // ─── I7: deleteDiagram must tear down its engine ─────────────────────
    it('destroys the engine and clears its persisted queue when its diagram is deleted', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.endsWith('/sync')) return { version: 2, conflicts: [] };
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
        await act(async () => {
            await storageRef.current!.getDiagram('d1');
        });

        act(() => {
            screen.getByRole('button').click(); // queues an update for t1
        });
        expect(localStorage.getItem('chartdb:sync-queue:d1')).not.toBeNull();

        await act(async () => {
            await storageRef.current!.deleteDiagram('d1');
        });

        expect(localStorage.getItem('chartdb:sync-queue:d1')).toBeNull();
        expect(localStorage.getItem('chartdb:sync-inflight:d1')).toBeNull();

        const before = vi
            .mocked(apiFetch)
            .mock.calls.filter(([p]) => p.includes('/sync')).length;
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20000);
        });
        // No retries against a diagram that no longer exists.
        expect(
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
        ).toHaveLength(before);
    });
});
