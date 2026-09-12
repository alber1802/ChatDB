import { describe, expect, it } from 'vitest';
import { syncRequestSchema } from '../src/lib/schemas.ts';

describe('syncRequestSchema', () => {
    it('accepts a valid batch', () => {
        const result = syncRequestSchema.parse({
            baseVersion: 1,
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 10 } },
                { entity: 'relationship', op: 'delete', id: 'r1' },
            ],
        });
        expect(result.operations).toHaveLength(2);
    });

    it('rejects an empty operations array', () => {
        expect(() =>
            syncRequestSchema.parse({ baseVersion: 1, operations: [] })
        ).toThrow();
    });

    it('rejects an unknown entity', () => {
        expect(() =>
            syncRequestSchema.parse({
                baseVersion: 1,
                operations: [{ entity: 'bogus', op: 'update', id: 'x' }],
            })
        ).toThrow();
    });
});
