import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
    generateInviteToken,
    hashInviteToken,
} from '../src/lib/invite-token.ts';
import {
    invitationsService,
    mapInvitationError,
} from '../src/modules/invitations/invitations.service.ts';
import { invitationCreateSchema } from '../src/lib/schemas.ts';
import { AppError } from '../src/lib/types.ts';

describe('invite tokens', () => {
    it('generates a url-safe token whose hash is its sha256', () => {
        const { token, tokenHash } = generateInviteToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(hashInviteToken(token)).toBe(tokenHash);
    });

    it('never repeats tokens', () => {
        expect(generateInviteToken().token).not.toBe(
            generateInviteToken().token
        );
    });
});

describe('invitationCreateSchema', () => {
    it('normalizes the email', () => {
        expect(
            invitationCreateSchema.parse({
                email: '  Ana@Example.COM ',
                role: 'editor',
            }).email
        ).toBe('ana@example.com');
    });

    it('rejects invalid emails and roles', () => {
        expect(() =>
            invitationCreateSchema.parse({ email: 'nope', role: 'editor' })
        ).toThrow();
        expect(() =>
            invitationCreateSchema.parse({ email: 'a@b.co', role: 'owner' })
        ).toThrow();
    });
});

describe('mapInvitationError', () => {
    const pgError = (message: string) =>
        Object.assign(new Error(message), { code: 'P0001' });

    it.each([
        ['not_owner', 403],
        ['invitation_exists', 409],
        ['already_member', 409],
        ['cannot_invite_self', 400],
        ['invitation_not_found', 404],
        ['invitation_expired', 410],
        ['invitation_email_mismatch', 403],
        ['query_too_short', 400],
        ['invalid_role', 400],
        ['user_not_found', 404],
    ])('maps %s to HTTP %i', (code, status) => {
        const mapped = mapInvitationError(pgError(code));
        expect(mapped).toBeInstanceOf(AppError);
        expect(mapped).toMatchObject({ statusCode: status, code });
    });

    it('leaves unknown errors untouched', () => {
        const err = new Error('boom');
        expect(mapInvitationError(err)).toBe(err);
    });
});

describe('invitationsService', () => {
    const clientReturning = (rows: unknown[]) => {
        const query = vi.fn(async () => ({ rows }));
        return { client: { query } as unknown as PoolClient, query };
    };

    it('create stores only the token hash and returns the raw token once', async () => {
        const { client, query } = clientReturning([
            {
                id: 'i1',
                email: 'ana@example.com',
                role: 'editor',
                status: 'pending',
                expires_at: '2026-10-01T00:00:00.000Z',
                created_at: '2026-09-24T00:00:00.000Z',
            },
        ]);
        const result = await invitationsService.create(
            client,
            'd1',
            'ana@example.com',
            'editor'
        );
        const params = query.mock.calls[0]![1] as unknown as string[];
        expect(params.slice(0, 3)).toEqual(['d1', 'ana@example.com', 'editor']);
        expect(params[3]).toBe(hashInviteToken(result.token));
        expect(params).not.toContain(result.token);
        expect(result.invitation).toEqual({
            id: 'i1',
            email: 'ana@example.com',
            role: 'editor',
            status: 'pending',
            expiresAt: '2026-10-01T00:00:00.000Z',
            createdAt: '2026-09-24T00:00:00.000Z',
        });
    });

    it('acceptByToken passes the hash, never the token', async () => {
        const { client, query } = clientReturning([
            { accept_diagram_invitation: 'd1' },
        ]);
        const diagramId = await invitationsService.acceptByToken(
            client,
            'raw-token'
        );
        expect(diagramId).toBe('d1');
        expect(query.mock.calls[0]![1]).toEqual([
            null,
            hashInviteToken('raw-token'),
        ]);
    });

    it('translates database business errors', async () => {
        const query = vi.fn(async () => {
            throw Object.assign(new Error('invitation_exists'), {
                code: 'P0001',
            });
        });
        await expect(
            invitationsService.create(
                { query } as unknown as PoolClient,
                'd1',
                'ana@example.com',
                'editor'
            )
        ).rejects.toMatchObject({ statusCode: 409, code: 'invitation_exists' });
    });
});
