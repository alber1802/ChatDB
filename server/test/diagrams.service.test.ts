import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { diagramsService } from '../src/modules/diagrams/diagrams.service.ts';

// `create` es un upsert (`ON CONFLICT (id) DO UPDATE`). Con diagramas
// compartidos, un editor pasa la política UPDATE de `diagrams`, así que si el
// upsert reescribiera `user_id` con el del llamante, un editor que haga
// `POST /diagrams` con el id de un diagrama ajeno se quedaría con la propiedad
// (y la política WITH CHECK `auth.uid() = user_id` lo aceptaría).
describe('diagramsService.create — ownership', () => {
    it('never reassigns user_id when the diagram already exists', async () => {
        const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
        const client = { query } as unknown as PoolClient;

        await diagramsService.create(
            client,
            {
                id: 'd1',
                name: 'Demo',
                databaseType: 'postgresql',
                version: 1,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            },
            'editor-user'
        );

        const diagramUpsert = String(
            query.mock.calls.find((c) =>
                String(c[0]).includes('INSERT INTO diagrams')
            )?.[0]
        );
        const updateClause = diagramUpsert.split('DO UPDATE SET')[1] ?? '';
        expect(updateClause).not.toContain('"user_id"');
        expect(updateClause).not.toContain('"created_at"');
    });
});

describe('diagramsService.list/get — access role', () => {
    it('selects the caller access role and the owner profile', async () => {
        const query = vi.fn(async () => ({ rows: [] }));
        const client = { query } as unknown as PoolClient;

        await diagramsService.list(client);
        await diagramsService.get(client, 'd1');

        for (const call of query.mock.calls) {
            const sql = String(call[0]);
            expect(sql).toContain('AS access_role');
            expect(sql).toContain('owner_display_name');
        }
    });
});
