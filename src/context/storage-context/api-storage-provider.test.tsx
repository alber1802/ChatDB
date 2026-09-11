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
});
