import { describe, expect, it } from 'vitest';
import type { DBTable } from '@/lib/domain/db-table';
import { diffTable } from '../table-diff';

const base = (): DBTable =>
    ({
        id: 't1',
        name: 'users',
        x: 0,
        y: 0,
        fields: [
            {
                id: 'f1',
                name: 'id',
                type: { id: 'int', name: 'int' },
                primaryKey: true,
                unique: true,
                nullable: false,
                createdAt: 1,
            },
            {
                id: 'f2',
                name: 'email',
                type: { id: 'varchar', name: 'varchar' },
                primaryKey: false,
                unique: false,
                nullable: true,
                createdAt: 2,
            },
        ],
        indexes: [
            {
                id: 'i1',
                name: 'pk',
                fieldIds: ['f1'],
                unique: true,
                createdAt: 1,
            },
        ],
        checkConstraints: [],
        color: '#fff',
        isView: false,
        createdAt: 1,
    }) as unknown as DBTable;

describe('diffTable', () => {
    it('emits nothing when nothing changed', () => {
        expect(diffTable(base(), base())).toEqual([]);
    });

    it('updates only the changed property of one field', () => {
        const next = base();
        next.fields = next.fields.map((f) =>
            f.id === 'f2' ? { ...f, nullable: false } : f
        );
        expect(diffTable(base(), next)).toEqual([
            {
                entity: 'field',
                op: 'update',
                id: 'f2',
                parentId: 't1',
                patch: { nullable: false },
            },
        ]);
    });

    it('sends removed optional keys as null', () => {
        const prev = base();
        prev.fields[1] = { ...prev.fields[1], comments: 'hola' };
        expect(diffTable(prev, base())).toEqual([
            {
                entity: 'field',
                op: 'update',
                id: 'f2',
                parentId: 't1',
                patch: { comments: null },
            },
        ]);
    });

    it('creates an added field after its previous sibling', () => {
        const next = base();
        const added = { ...next.fields[1], id: 'f3', name: 'name' };
        next.fields = [next.fields[0], added, next.fields[1]];
        expect(diffTable(base(), next)).toEqual([
            {
                entity: 'field',
                op: 'create',
                id: 'f3',
                parentId: 't1',
                afterId: 'f1',
                patch: added,
            },
        ]);
    });

    it('creates a field placed first with afterId null', () => {
        const next = base();
        const added = { ...next.fields[1], id: 'f0' };
        next.fields = [added, ...next.fields];
        expect(diffTable(base(), next)[0]).toMatchObject({
            op: 'create',
            id: 'f0',
            afterId: null,
        });
    });

    it('deletes a removed field', () => {
        const next = base();
        next.fields = [next.fields[0]];
        expect(diffTable(base(), next)).toEqual([
            { entity: 'field', op: 'delete', id: 'f2', parentId: 't1' },
        ]);
    });

    it('also diffs indexes and check constraints', () => {
        const next = base();
        next.indexes = [{ ...next.indexes[0], name: 'users_pk' }];
        next.checkConstraints = [
            { id: 'c1', expression: 'id > 0', createdAt: 1 },
        ] as DBTable['checkConstraints'];
        expect(diffTable(base(), next)).toEqual([
            {
                entity: 'index',
                op: 'update',
                id: 'i1',
                parentId: 't1',
                patch: { name: 'users_pk' },
            },
            {
                entity: 'checkConstraint',
                op: 'create',
                id: 'c1',
                parentId: 't1',
                afterId: null,
                patch: { id: 'c1', expression: 'id > 0', createdAt: 1 },
            },
        ]);
    });

    it('falls back to replacing the whole array when existing elements were reordered', () => {
        const next = base();
        next.fields = [next.fields[1], next.fields[0]];
        expect(diffTable(base(), next)).toEqual([
            {
                entity: 'table',
                op: 'update',
                id: 't1',
                patch: { fields: next.fields },
            },
        ]);
    });

    it('patches changed table-level properties in a table op', () => {
        const next = { ...base(), name: 'accounts', color: '#000' };
        expect(diffTable(base(), next)).toEqual([
            {
                entity: 'table',
                op: 'update',
                id: 't1',
                patch: { name: 'accounts', color: '#000' },
            },
        ]);
    });
});
