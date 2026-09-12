import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ApiStorageProvider } from './api-storage-provider';
import { useStorage } from '@/hooks/use-storage';
import { apiFetch } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import type { DBTable } from '@/lib/domain/db-table';

vi.mock('@/lib/api-client', async () => {
    const actual =
        await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
    return { ...actual, apiFetch: vi.fn() };
});

// Imperative handle so the test can drive `getDiagram` directly before the
// burst, the same way the real editor loads a diagram (which primes the
// SyncEngine via ensureEngine) before the user can reach any update control.
// `updateTable` resolves its target diagram from the already-active engine
// (see ApiStorageProvider.updateTable), so a write burst with no diagram ever
// loaded would have nowhere to enqueue to.
type StorageHandle = ReturnType<typeof useStorage>;

function EditBurst({
    count,
    storageRef,
}: {
    count: number;
    storageRef: { current: StorageHandle | null };
}) {
    const storage = useStorage();
    storageRef.current = storage;
    return (
        <button
            onClick={() => {
                for (let i = 0; i < count; i++) {
                    storage.updateTable({
                        id: `t${i % 10}`,
                        attributes: { name: `name-${i}` },
                    });
                }
            }}
        >
            burst
        </button>
    );
}

function ImportBurst() {
    const storage = useStorage();
    return (
        <button
            onClick={() => {
                for (let i = 0; i < 100; i++) {
                    storage.addTable({
                        diagramId: 'd1',
                        table: {
                            id: `t${i}`,
                            name: `table_${i}`,
                        } as unknown as DBTable,
                    });
                }
            }}
        >
            import
        </button>
    );
}

describe('sync engine benchmark: requests per edit burst', () => {
    beforeEach(() => {
        vi.mocked(apiFetch).mockReset();
        vi.useFakeTimers();
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.endsWith('/sync')) return { version: 2, conflicts: [] };
            if (path.startsWith('/diagrams/')) return { id: 'd1', version: 1 };
            return undefined;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('20 field edits across 10 tables produce exactly 1 request (vs. 60 before)', async () => {
        const storageRef: { current: StorageHandle | null } = {
            current: null,
        };
        render(
            <ApiStorageProvider>
                <EditBurst count={20} storageRef={storageRef} />
            </ApiStorageProvider>
        );

        // Mirrors the real app: the editor loads the diagram (establishing
        // the SyncEngine via ensureEngine) before the user can trigger any
        // edit.
        await act(async () => {
            await storageRef.current!.getDiagram('d1');
        });

        act(() => {
            screen.getByRole('button').click();
        });

        // advanceTimersByTimeAsync flushes both the debounce timer and the
        // microtasks created by the mocked apiFetch call it triggers, so the
        // /sync request has already completed by the time this resolves.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });

        const syncCalls = vi
            .mocked(apiFetch)
            .mock.calls.filter(([p]) => (p as string).includes('/sync'));
        expect(syncCalls).toHaveLength(1);

        // Counting requests alone would also pass if the batch silently
        // dropped operations, so assert the payload really carries them: the
        // 20 edits target `t0`..`t9`, and repeated edits to the same table are
        // collapsed by id, so exactly 10 operations should go on the wire.
        const body = JSON.parse(
            (syncCalls[0][1] as RequestInit).body as string
        );
        expect(body.operations).toHaveLength(10);
        expect(
            [
                ...new Set(body.operations.map((o: { id: string }) => o.id)),
            ].sort()
        ).toEqual(Array.from({ length: 10 }, (_, i) => `t${i}`).sort());
        // Last write wins for each table.
        const t0 = body.operations.find((o: { id: string }) => o.id === 't0');
        expect(t0).toMatchObject({
            entity: 'table',
            op: 'update',
            patch: { name: 'name-10' },
        });
    });

    it('100 table creates (large import) still produce exactly 1 request', async () => {
        render(
            <ApiStorageProvider>
                <ImportBurst />
            </ApiStorageProvider>
        );

        act(() => {
            screen.getByRole('button').click();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });

        const syncCalls = vi
            .mocked(apiFetch)
            .mock.calls.filter(([p]) => (p as string).includes('/sync'));
        expect(syncCalls).toHaveLength(1);

        // 100 distinct ids, so nothing collapses: all 100 creates must be in
        // the single batched payload.
        const body = JSON.parse(
            (syncCalls[0][1] as RequestInit).body as string
        );
        expect(body.operations).toHaveLength(100);
        expect(
            body.operations.every(
                (o: { entity: string; op: string }) =>
                    o.entity === 'table' && o.op === 'create'
            )
        ).toBe(true);
    });
});
