import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { sharesService } from '../src/modules/shares/shares.service.ts';
import { shareRolePatchSchema } from '../src/lib/schemas.ts';

const clientWith = (result: { rows?: unknown[]; rowCount?: number }) => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0, ...result }));
    return { client: { query } as unknown as PoolClient, query };
};

describe('shareRolePatchSchema', () => {
    it('accepts editor and viewer', () => {
        expect(shareRolePatchSchema.parse({ role: 'viewer' }).role).toBe(
            'viewer'
        );
        expect(shareRolePatchSchema.parse({ role: 'editor' }).role).toBe(
            'editor'
        );
    });

    it('rejects owner or unknown roles', () => {
        expect(() => shareRolePatchSchema.parse({ role: 'owner' })).toThrow();
        expect(() => shareRolePatchSchema.parse({})).toThrow();
    });
});

describe('sharesService', () => {
    it('lists members with their profile', async () => {
        const { client } = clientWith({
            rows: [
                {
                    id: 's1',
                    diagram_id: 'd1',
                    owner_id: 'o1',
                    shared_with: 'u2',
                    role: 'viewer',
                    created_at: '2026-01-01T00:00:00.000Z',
                    display_name: 'Ana',
                    avatar_url: null,
                },
            ],
        });
        const members = await sharesService.list(client, 'd1');
        expect(members).toEqual([
            {
                id: 's1',
                diagramId: 'd1',
                ownerId: 'o1',
                sharedWith: 'u2',
                role: 'viewer',
                createdAt: '2026-01-01T00:00:00.000Z',
                displayName: 'Ana',
                avatarUrl: null,
            },
        ]);
    });

    it('updates the role of a share scoped to the diagram', async () => {
        const { client, query } = clientWith({
            rowCount: 1,
            rows: [{ id: 's1', role: 'viewer' }],
        });
        await sharesService.updateRole(client, 'd1', 's1', 'viewer');
        const [sql, params] = query.mock.calls[0] as unknown as [
            string,
            unknown[],
        ];
        expect(sql).toMatch(/UPDATE diagram_shares/);
        expect(sql).toMatch(/diagram_id = \$\d/);
        expect(params).toEqual(expect.arrayContaining(['d1', 's1', 'viewer']));
    });

    it('throws 404 when the role update touches no row (not owner / missing)', async () => {
        const { client } = clientWith({ rowCount: 0 });
        await expect(
            sharesService.updateRole(client, 'd1', 's1', 'viewer')
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('leave deletes only the caller own share on that diagram', async () => {
        const { client, query } = clientWith({ rowCount: 1 });
        await sharesService.leave(client, 'd1', 'u2');
        const [sql, params] = query.mock.calls[0] as unknown as [
            string,
            unknown[],
        ];
        expect(sql).toMatch(/DELETE FROM diagram_shares/);
        expect(sql).toMatch(/shared_with = \$\d/);
        expect(params).toEqual(['d1', 'u2']);
    });

    it('leave throws 404 when the caller is not a member', async () => {
        const { client } = clientWith({ rowCount: 0 });
        await expect(
            sharesService.leave(client, 'd1', 'u2')
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('shares directly with a system user through the SQL function', async () => {
        const { client, query } = clientWith({
            rows: [{ share_diagram_with_user: 's9' }],
        });
        const id = await sharesService.shareWithUser(
            client,
            'd1',
            '00000000-0000-0000-0000-000000000002',
            'viewer'
        );
        expect(id).toBe('s9');
        expect(String(query.mock.calls[0]![0])).toMatch(
            /share_diagram_with_user\(\$1, \$2, \$3\)/
        );
    });

    it('maps business errors of the direct share', async () => {
        const query = vi.fn(async () => {
            throw Object.assign(new Error('already_member'), { code: 'P0001' });
        });
        await expect(
            sharesService.shareWithUser(
                { query } as unknown as PoolClient,
                'd1',
                'u2',
                'editor'
            )
        ).rejects.toMatchObject({ statusCode: 409, code: 'already_member' });
    });
});
