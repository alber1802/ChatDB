import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
    applyOperation,
    collapseOperations,
    syncService,
} from '../src/modules/sync/sync.service.ts';

describe('collapseOperations', () => {
    it('merges sequential updates to the same entity into one', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'table', op: 'update', id: 't1', patch: { y: 2 } },
        ]);
        expect(result).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1, y: 2 } },
        ]);
    });

    it('a delete after any op wins and drops the patch', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'table', op: 'delete', id: 't1' },
        ]);
        expect(result).toEqual([{ entity: 'table', op: 'delete', id: 't1' }]);
    });

    it('a create after a delete for the same id is treated as a fresh create', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'delete', id: 't1' },
            { entity: 'table', op: 'create', id: 't1', patch: { name: 'x' } },
        ]);
        expect(result).toEqual([
            { entity: 'table', op: 'create', id: 't1', patch: { name: 'x' } },
        ]);
    });

    it('keeps unrelated entities separate', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'area', op: 'update', id: 'a1', patch: { x: 2 } },
        ]);
        expect(result).toHaveLength(2);
    });
});

// Estos tests ejercitan el `diagramPatchSchema` REAL (sin mocks): es
// exactamente lo que debería haber cazado el bug original, en el que un
// `patch: {}` lanzaba ZodError y abortaba la transacción completa del batch
// (no se guardaba nada y el cliente reintentaba el lote envenenado siempre).
describe('applyOperation — diagram patches', () => {
    const fakeClient = () =>
        ({ query: vi.fn() }) as unknown as PoolClient & {
            query: ReturnType<typeof vi.fn>;
        };

    it('treats an empty diagram patch as a no-op instead of throwing', async () => {
        const client = fakeClient();
        await expect(
            applyOperation(client, 'd1', 'u1', {
                entity: 'diagram',
                op: 'update',
                id: 'd1',
                patch: {},
            })
        ).resolves.toBeUndefined();
        expect(client.query).not.toHaveBeenCalled();
    });

    it('treats a missing diagram patch as a no-op instead of throwing', async () => {
        const client = fakeClient();
        await expect(
            applyOperation(client, 'd1', 'u1', {
                entity: 'diagram',
                op: 'update',
                id: 'd1',
            })
        ).resolves.toBeUndefined();
        expect(client.query).not.toHaveBeenCalled();
    });

    it('still validates a non-empty diagram patch', async () => {
        const client = fakeClient();
        // `name` vacío sigue siendo inválido: el guard es un no-op para patches
        // vacíos, no una desactivación de la validación.
        await expect(
            applyOperation(client, 'd1', 'u1', {
                entity: 'diagram',
                op: 'update',
                id: 'd1',
                patch: { name: '' },
            })
        ).rejects.toThrow();
    });

    it('a batch whose only operation is an empty diagram patch still commits', async () => {
        const client = {
            query: vi.fn(async (sql: string) => {
                if (sql.includes('SELECT version')) {
                    return { rows: [{ version: 1, last_sync_session_id: null }] };
                }
                return { rows: [] };
            }),
        } as unknown as PoolClient;

        const result = await syncService.apply(client, 'd1', 'u1', {
            baseVersion: 1,
            operations: [
                { entity: 'diagram', op: 'update', id: 'd1', patch: {} },
            ],
        });

        // Antes del arreglo esto lanzaba ZodError y hacía rollback del batch.
        expect(result).toEqual({ version: 2, conflicts: [] });
    });
});

// El contador `diagrams.version` es global al diagrama, no por fila. Un
// reintento de la MISMA sesión (p.ej. el ack de un POST anterior se perdió
// mientras el servidor ya lo había aplicado) hace que `baseVersion` del
// cliente quede desfasado de `currentVersion` exactamente igual que si otra
// sesión hubiese escrito — sin distinguir por sesión, ese reintento se
// reportaba como "conflicto" (ver api-storage-provider.tsx:58, "Sync
// conflicts overwritten by another session") aunque nadie más tocó el
// diagrama.
describe('syncService.apply — conflict detection is per-session, not just per-version', () => {
    const clientReturning = (version: number, lastSyncSessionId: string | null) =>
        ({
            query: vi.fn(async (sql: string) => {
                if (sql.includes('SELECT version')) {
                    return {
                        rows: [
                            { version, last_sync_session_id: lastSyncSessionId },
                        ],
                    };
                }
                return { rows: [] };
            }),
        }) as unknown as PoolClient;

    it('does NOT report a conflict when the version moved due to this same session retrying', async () => {
        // El servidor ya está en version=2 por un write anterior de
        // session-A cuyo ack el cliente nunca vio; reintenta con el
        // baseVersion viejo (1) pero identificándose con la misma sesión.
        const client = clientReturning(2, 'session-A');

        const result = await syncService.apply(client, 'd1', 'u1', {
            baseVersion: 1,
            sessionId: 'session-A',
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ],
        });

        expect(result.conflicts).toEqual([]);
    });

    it('DOES report a conflict when the version moved due to a different session', async () => {
        const client = clientReturning(2, 'session-B');

        const result = await syncService.apply(client, 'd1', 'u1', {
            baseVersion: 1,
            sessionId: 'session-A',
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ],
        });

        expect(result.conflicts).toEqual([{ entity: 'table', id: 't1' }]);
    });

    it('falls back to the old coarse behavior when the client sends no sessionId', async () => {
        const client = clientReturning(2, 'session-B');

        const result = await syncService.apply(client, 'd1', 'u1', {
            baseVersion: 1,
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ],
        });

        expect(result.conflicts).toEqual([{ entity: 'table', id: 't1' }]);
    });

    it('records the writer session id so the next request can compare against it', async () => {
        const client = clientReturning(1, null);

        await syncService.apply(client, 'd1', 'u1', {
            baseVersion: 1,
            sessionId: 'session-A',
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            ],
        });

        const updateCall = (
            client.query as unknown as ReturnType<typeof vi.fn>
        ).mock.calls.find((call) =>
            String(call[0]).includes('UPDATE diagrams')
        );
        expect(updateCall?.[1]).toEqual([2, 'session-A', 'd1']);
    });
});
