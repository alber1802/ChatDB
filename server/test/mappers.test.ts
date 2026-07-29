import { describe, expect, it } from 'vitest';
import {
    diagramToRow,
    rowToDiagram,
    rowToTable,
    tableToRow,
} from '../src/lib/mappers.ts';

describe('mappers', () => {
    it('round-trips a diagram', () => {
        const diagram = {
            id: 'd1',
            name: 'Demo',
            databaseType: 'postgresql',
            databaseEdition: undefined,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
        };
        const row = diagramToRow(diagram, '11111111-1111-1111-1111-111111111111');
        const back = rowToDiagram(row as unknown as Record<string, unknown>);
        expect(back.id).toBe('d1');
        expect(back.name).toBe('Demo');
        expect(back.databaseType).toBe('postgresql');
        expect(row.user_id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('maps table comments field', () => {
        const table = {
            id: 't1',
            name: 'users',
            x: 10,
            y: 20,
            fields: [],
            indexes: [],
            comments: 'hello',
            isView: false,
            isMaterializedView: false,
            createdAt: Date.now(),
        };
        const row = tableToRow(
            table,
            'd1',
            '11111111-1111-1111-1111-111111111111'
        );
        expect(row.comment).toBe('hello');
        const back = rowToTable({
            ...row,
            fields: [],
            indexes: [],
            created_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>);
        expect(back.comments).toBe('hello');
    });
});
