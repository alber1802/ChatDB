import { describe, expect, it } from 'vitest';
import { collapseOperations } from '../src/modules/sync/sync.service.ts';

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
