import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
    collapseOperations,
    resetOpsTableDetection,
    syncService,
    type SyncOperation,
} from '../src/modules/sync/sync.service.ts';
import { syncRequestSchema } from '../src/lib/schemas.ts';
import { rowToTable, tableToRow } from '../src/lib/mappers.ts';

/**
 * Fase 4-a de colaboración (docs/collaboration/04-conflicts-and-consistency.md):
 * columnas, índices y CHECK son elementos de arrays JSONB de db_tables. Antes
 * cada edición reescribía el array completo, así que dos editores de columnas
 * distintas de la misma tabla se pisaban. Ahora cada op toca un elemento.
 */

type Row = Record<string, unknown>;

beforeEach(() => resetOpsTableDetection());

/** Cliente falso con una única tabla en memoria, suficiente para las ops. */
function fakeDb(table: Row | null) {
    const writes: { column: string; value: unknown[] }[] = [];
    const storedBatches = new Map<string, unknown>();
    let opsTable = false;
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('AS access_role'))
            return { rows: [{ access_role: 'editor' }] };
        if (sql.includes('to_regclass'))
            return { rows: [{ available: opsTable }] };
        if (sql.includes('SELECT result FROM diagram_ops')) {
            const r = storedBatches.get(String(params[1]));
            return { rows: r ? [{ result: r }] : [] };
        }
        if (sql.includes('INSERT INTO diagram_ops')) {
            storedBatches.set(String(params[2]), JSON.parse(String(params[6])));
            return { rows: [] };
        }
        if (sql.includes('SELECT version'))
            return { rows: [{ version: 1, last_sync_session_id: null }] };
        const select = sql.match(
            /SELECT (fields|indexes|check_constraints) FROM db_tables/
        );
        if (select) {
            expect(params).toEqual(['d1', 't1']);
            return { rows: table ? [{ [select[1]]: table[select[1]] }] : [] };
        }
        const update = sql.match(
            /UPDATE db_tables SET (fields|indexes|check_constraints) = \$1/
        );
        if (update) {
            expect(sql).toMatch(/WHERE diagram_id = \$2 AND id = \$3/);
            const value = JSON.parse(String(params[0]));
            writes.push({ column: update[1], value });
            if (table) table[update[1]] = value;
            return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
    });
    return {
        client: { query } as unknown as PoolClient,
        query,
        writes,
        enableOpsTable: () => (opsTable = true),
    };
}

const table = (): Row => ({
    fields: [
        { id: 'f1', name: 'id', type: 'int', primaryKey: true },
        { id: 'f2', name: 'email', type: 'varchar' },
    ],
    indexes: [{ id: 'i1', name: 'pk', fieldIds: ['f1'] }],
    check_constraints: [],
});

const apply = (
    client: PoolClient,
    operations: SyncOperation[],
    batchId?: string
) =>
    syncService.apply(client, 'd1', 'u1', {
        baseVersion: 1,
        sessionId: 's1',
        batchId,
        operations,
    });

describe('sub-entity operations', () => {
    it('updates only the patched properties of one field', async () => {
        const db = fakeDb(table());
        await apply(db.client, [
            {
                entity: 'field',
                op: 'update',
                id: 'f2',
                parentId: 't1',
                patch: { type: 'text' },
            },
        ]);
        expect(db.writes).toHaveLength(1);
        expect(db.writes[0].value).toEqual([
            { id: 'f1', name: 'id', type: 'int', primaryKey: true },
            { id: 'f2', name: 'email', type: 'text' },
        ]);
    });

    it('two editors changing different fields of the same table both survive', async () => {
        const t = table();
        const db = fakeDb(t);
        await apply(db.client, [
            {
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 't1',
                patch: { name: 'user_id' },
            },
        ]);
        await apply(db.client, [
            {
                entity: 'field',
                op: 'update',
                id: 'f2',
                parentId: 't1',
                patch: { type: 'text' },
            },
        ]);
        expect(t.fields).toEqual([
            { id: 'f1', name: 'user_id', type: 'int', primaryKey: true },
            { id: 'f2', name: 'email', type: 'text' },
        ]);
    });

    it('creates a field right after its sibling', async () => {
        const db = fakeDb(table());
        await apply(db.client, [
            {
                entity: 'field',
                op: 'create',
                id: 'f3',
                parentId: 't1',
                afterId: 'f1',
                patch: { id: 'f3', name: 'name', type: 'text' },
            },
        ]);
        expect((db.writes[0].value as Row[]).map((f) => f.id)).toEqual([
            'f1',
            'f3',
            'f2',
        ]);
    });

    it('creates at the start when afterId is null and at the end when unknown', async () => {
        const db = fakeDb(table());
        await apply(db.client, [
            {
                entity: 'index',
                op: 'create',
                id: 'i0',
                parentId: 't1',
                afterId: null,
                patch: { name: 'a' },
            },
            {
                entity: 'checkConstraint',
                op: 'create',
                id: 'c1',
                parentId: 't1',
                afterId: 'nope',
                patch: { expression: 'x > 0' },
            },
        ]);
        expect(db.writes.find((w) => w.column === 'indexes')!.value).toEqual([
            { id: 'i0', name: 'a' },
            { id: 'i1', name: 'pk', fieldIds: ['f1'] },
        ]);
        expect(
            db.writes.find((w) => w.column === 'check_constraints')!.value
        ).toEqual([{ id: 'c1', expression: 'x > 0' }]);
    });

    it('deletes one element and is idempotent when it is already gone', async () => {
        const db = fakeDb(table());
        const result = await apply(db.client, [
            { entity: 'field', op: 'delete', id: 'f2', parentId: 't1' },
            { entity: 'index', op: 'delete', id: 'missing', parentId: 't1' },
        ]);
        expect((db.writes[0].value as Row[]).map((f) => f.id)).toEqual(['f1']);
        expect(result.rejected).toEqual([]);
    });

    it('rejects an update to a field that no longer exists without aborting the batch', async () => {
        const db = fakeDb(table());
        const result = await apply(db.client, [
            {
                opId: 'op-a',
                entity: 'field',
                op: 'update',
                id: 'gone',
                parentId: 't1',
                patch: { name: 'x' },
            },
            {
                opId: 'op-b',
                entity: 'field',
                op: 'update',
                id: 'f2',
                parentId: 't1',
                patch: { name: 'mail' },
            },
        ]);
        expect(result.rejected).toEqual([
            {
                opId: 'op-a',
                entity: 'field',
                id: 'gone',
                reason: 'entity_deleted',
            },
        ]);
        expect(result.applied).toContain('op-b');
        const sqls = db.query.mock.calls.map((c) => String(c[0]));
        expect(sqls.some((s) => s.startsWith('ROLLBACK TO SAVEPOINT'))).toBe(
            true
        );
    });

    it('rejects sub-entity ops whose table was deleted', async () => {
        const db = fakeDb(null);
        const result = await apply(db.client, [
            {
                opId: 'op-a',
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 't1',
                patch: { name: 'x' },
            },
        ]);
        expect(result.rejected[0]).toMatchObject({ reason: 'entity_deleted' });
    });

    it('rejects an invalid op with validation_failed and keeps the rest', async () => {
        const db = fakeDb(table());
        const result = await apply(db.client, [
            {
                opId: 'bad',
                entity: 'table',
                op: 'update',
                id: 't1',
                patch: { x: 'not-a-number' },
            },
            {
                opId: 'good',
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 't1',
                patch: { name: 'k' },
            },
        ]);
        expect(result.rejected).toEqual([
            {
                opId: 'bad',
                entity: 'table',
                id: 't1',
                reason: 'validation_failed',
            },
        ]);
        expect(result.applied).toEqual(['good']);
    });
});

describe('batch idempotency (batchId)', () => {
    it('a retried batch with the same batchId is not applied twice', async () => {
        const db = fakeDb(table());
        db.enableOpsTable();
        const ops: SyncOperation[] = [
            {
                entity: 'field',
                op: 'create',
                id: 'f3',
                parentId: 't1',
                patch: { name: 'n' },
            },
        ];
        const first = await apply(db.client, ops, 'b-1');
        const second = await apply(db.client, ops, 'b-1');
        expect(second).toEqual(first);
        expect(db.writes).toHaveLength(1);
    });

    it('works without the diagram_ops table (migration not applied yet)', async () => {
        const db = fakeDb(table());
        await apply(
            db.client,
            [{ entity: 'field', op: 'delete', id: 'f2', parentId: 't1' }],
            'b-2'
        );
        const sqls = db.query.mock.calls.map((c) => String(c[0]));
        expect(sqls.some((s) => s.includes('INSERT INTO diagram_ops'))).toBe(
            false
        );
    });
});

describe('collapseOperations with sub-entities', () => {
    it('keeps same-id fields of different tables separate and merges same field', () => {
        const result = collapseOperations([
            {
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 't1',
                patch: { a: 1 },
            },
            {
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 't2',
                patch: { a: 2 },
            },
            {
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 't1',
                patch: { b: 3 },
            },
        ]);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            parentId: 't1',
            patch: { a: 1, b: 3 },
        });
    });
});

describe('syncRequestSchema — sub-entities', () => {
    it('accepts field ops with parentId, opId and batchId', () => {
        const parsed = syncRequestSchema.parse({
            baseVersion: 1,
            batchId: '00000000-0000-4000-8000-000000000001',
            operations: [
                {
                    opId: 'o1',
                    entity: 'field',
                    op: 'update',
                    id: 'f1',
                    parentId: 't1',
                    patch: {},
                },
            ],
        });
        expect(parsed.operations[0].parentId).toBe('t1');
    });

    it('requires parentId for sub-entity ops', () => {
        expect(() =>
            syncRequestSchema.parse({
                baseVersion: 1,
                operations: [
                    { entity: 'field', op: 'update', id: 'f1', patch: {} },
                ],
            })
        ).toThrow();
    });
});

describe('table mappers — columns that were silently dropped', () => {
    it('persists checkConstraints, expanded and parentAreaId', () => {
        const row = tableToRow(
            {
                id: 't1',
                name: 'users',
                x: 0,
                y: 0,
                fields: [],
                indexes: [],
                checkConstraints: [{ id: 'c1', expression: 'age > 0' }],
                expanded: true,
                parentAreaId: 'a1',
                isView: false,
                isMaterializedView: false,
                createdAt: 0,
            },
            'd1',
            'u1'
        );
        expect(JSON.parse(String(row.check_constraints))).toEqual([
            { id: 'c1', expression: 'age > 0' },
        ]);
        expect(row.expanded).toBe(true);
        expect(row.parent_area_id).toBe('a1');

        const back = rowToTable({
            ...row,
            check_constraints: [{ id: 'c1', expression: 'age > 0' }],
            created_at: new Date(0).toISOString(),
        });
        expect(back.checkConstraints).toEqual([
            { id: 'c1', expression: 'age > 0' },
        ]);
        expect(back.expanded).toBe(true);
        expect(back.parentAreaId).toBe('a1');
    });
});
