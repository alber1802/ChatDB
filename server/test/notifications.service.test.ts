import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { notificationsService } from '../src/modules/notifications/notifications.service.ts';
import { notificationsReadSchema } from '../src/lib/schemas.ts';

describe('notificationsService', () => {
    it('lists the latest notifications with the unread count', async () => {
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('count(*)')) return { rows: [{ unread: 2 }] };
            return {
                rows: [
                    {
                        id: 'n1',
                        type: 'diagram_shared',
                        diagram_id: 'd1',
                        payload: { diagram_name: 'Ventas', role: 'editor' },
                        read_at: null,
                        created_at: '2026-09-24T10:00:00.000Z',
                    },
                ],
            };
        });
        const result = await notificationsService.list(
            { query } as unknown as PoolClient,
            20
        );
        expect(result).toEqual({
            unreadCount: 2,
            items: [
                {
                    id: 'n1',
                    type: 'diagram_shared',
                    diagramId: 'd1',
                    payload: { diagram_name: 'Ventas', role: 'editor' },
                    readAt: null,
                    createdAt: '2026-09-24T10:00:00.000Z',
                },
            ],
        });
        const listSql = String(query.mock.calls[0]![0]);
        expect(listSql).toMatch(/LIMIT \$1/);
    });

    it('marks the given notifications as read', async () => {
        const query = vi.fn(async () => ({ rows: [], rowCount: 2 }));
        await notificationsService.markRead(
            { query } as unknown as PoolClient,
            ['00000000-0000-0000-0000-000000000001']
        );
        const [sql, params] = query.mock.calls[0] as unknown as [
            string,
            unknown[],
        ];
        expect(sql).toMatch(/SET read_at = now\(\)/);
        expect(sql).toMatch(/id = ANY\(\$1/);
        expect(params).toEqual([['00000000-0000-0000-0000-000000000001']]);
    });

    it('marks everything as read when no ids are given', async () => {
        const query = vi.fn(async () => ({ rows: [], rowCount: 5 }));
        await notificationsService.markRead(
            { query } as unknown as PoolClient,
            undefined
        );
        const [sql, params] = query.mock.calls[0] as unknown as [
            string,
            unknown[],
        ];
        expect(sql).toMatch(/read_at IS NULL/);
        expect(sql).not.toMatch(/ANY/);
        expect(params).toEqual([]);
    });
});

describe('notificationsReadSchema', () => {
    it('accepts an optional list of uuids', () => {
        expect(notificationsReadSchema.parse({})).toEqual({});
        expect(() =>
            notificationsReadSchema.parse({ ids: ['not-a-uuid'] })
        ).toThrow();
    });
});
