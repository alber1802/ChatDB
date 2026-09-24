import { describe, expect, it } from 'vitest';
import {
    applyRemoteOperations,
    type RemoteDiagramState,
} from '../apply-remote-operations';

const state = (): RemoteDiagramState =>
    ({
        diagram: { name: 'Ventas', databaseType: 'postgresql' },
        tables: [
            {
                id: 't1',
                name: 'users',
                x: 0,
                y: 0,
                fields: [
                    { id: 'f1', name: 'id' },
                    { id: 'f2', name: 'email' },
                ],
                indexes: [],
                checkConstraints: [],
            },
            { id: 't2', name: 'orders', x: 10, y: 10, fields: [], indexes: [] },
        ],
        relationships: [{ id: 'r1', name: 'r' }],
        dependencies: [],
        areas: [{ id: 'a1', name: 'Zona', x: 0, y: 0 }],
        customTypes: [],
        notes: [],
    }) as unknown as RemoteDiagramState;

describe('applyRemoteOperations', () => {
    it('updates one table and keeps every other reference', () => {
        const before = state();
        const after = applyRemoteOperations(before, [
            { entity: 'table', op: 'update', id: 't1', patch: { x: 50 } },
        ]);
        expect(after.tables[0]).toMatchObject({ id: 't1', x: 50 });
        expect(after.tables[1]).toBe(before.tables[1]);
        expect(after.relationships).toBe(before.relationships);
        expect(after.areas).toBe(before.areas);
    });

    it('returns the very same state object when nothing changes', () => {
        const before = state();
        expect(applyRemoteOperations(before, [])).toBe(before);
    });

    it('applies field ops inside the right table', () => {
        const after = applyRemoteOperations(state(), [
            {
                entity: 'field',
                op: 'update',
                id: 'f2',
                parentId: 't1',
                patch: { name: 'mail' },
            },
            {
                entity: 'field',
                op: 'create',
                id: 'f3',
                parentId: 't1',
                afterId: 'f1',
                patch: { id: 'f3', name: 'name' },
            },
            { entity: 'field', op: 'delete', id: 'f1', parentId: 't1' },
        ]);
        expect(after.tables[0].fields.map((f) => [f.id, f.name])).toEqual([
            ['f3', 'name'],
            ['f2', 'mail'],
        ]);
    });

    it('creates at the start with afterId null and at the end with an unknown afterId', () => {
        const after = applyRemoteOperations(state(), [
            {
                entity: 'field',
                op: 'create',
                id: 'f0',
                parentId: 't1',
                afterId: null,
                patch: { name: 'first' },
            },
            {
                entity: 'index',
                op: 'create',
                id: 'i1',
                parentId: 't1',
                afterId: 'x',
                patch: { name: 'idx' },
            },
        ]);
        expect(after.tables[0].fields[0].id).toBe('f0');
        expect(after.tables[0].indexes).toEqual([{ id: 'i1', name: 'idx' }]);
    });

    it('ignores sub-entity ops for a table that does not exist', () => {
        const before = state();
        const after = applyRemoteOperations(before, [
            {
                entity: 'field',
                op: 'update',
                id: 'f1',
                parentId: 'nope',
                patch: { name: 'x' },
            },
        ]);
        expect(after).toBe(before);
    });

    it('creates, updates and deletes top-level entities', () => {
        const after = applyRemoteOperations(state(), [
            {
                entity: 'table',
                op: 'create',
                id: 't3',
                patch: {
                    id: 't3',
                    name: 'items',
                    x: 1,
                    y: 1,
                    fields: [],
                    indexes: [],
                },
            },
            { entity: 'relationship', op: 'delete', id: 'r1' },
            { entity: 'area', op: 'update', id: 'a1', patch: { name: 'Core' } },
            {
                entity: 'note',
                op: 'create',
                id: 'n1',
                patch: { id: 'n1', content: 'hola' },
            },
            { entity: 'table', op: 'delete', id: 't2' },
        ]);
        expect(after.tables.map((t) => t.id)).toEqual(['t1', 't3']);
        expect(after.relationships).toEqual([]);
        expect(after.areas[0]).toMatchObject({ name: 'Core' });
        expect(after.notes).toEqual([{ id: 'n1', content: 'hola' }]);
    });

    it('treats a create of an existing id as an update (idempotent)', () => {
        const after = applyRemoteOperations(state(), [
            {
                entity: 'table',
                op: 'create',
                id: 't1',
                patch: { name: 'people' },
            },
        ]);
        expect(after.tables).toHaveLength(2);
        expect(after.tables[0]).toMatchObject({
            id: 't1',
            name: 'people',
            x: 0,
        });
    });

    it('updates the diagram metadata', () => {
        const after = applyRemoteOperations(state(), [
            {
                entity: 'diagram',
                op: 'update',
                id: 'd1',
                patch: { name: 'Ventas 2' },
            },
        ]);
        expect(after.diagram.name).toBe('Ventas 2');
    });
});
