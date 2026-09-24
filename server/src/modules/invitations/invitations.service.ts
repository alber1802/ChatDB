import type { PoolClient } from 'pg';
import { AppError } from '../../lib/types.js';
import {
    generateInviteToken,
    hashInviteToken,
} from '../../lib/invite-token.js';

export type InvitationRole = 'editor' | 'viewer';

export interface InvitationDto {
    id: string;
    email: string;
    role: InvitationRole;
    status: string;
    expiresAt: string;
    createdAt: string;
}

export interface MyInvitationDto {
    id: string;
    diagramId: string;
    diagramName: string;
    role: InvitationRole;
    expiresAt: string;
    createdAt: string;
    invitedBy: { displayName: string | null; avatarUrl: string | null };
}

export interface ShareCandidateDto {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    email: string;
}

// Las funciones SQL (server/sql/2026-09-23-collab-invitations.sql) señalan
// errores de negocio con RAISE EXCEPTION '<código>' (SQLSTATE P0001).
const BUSINESS_ERRORS: Record<string, [number, string]> = {
    not_owner: [403, 'Only the diagram owner can manage invitations'],
    invitation_exists: [
        409,
        'There is already a pending invitation for this email',
    ],
    already_member: [409, 'This user already has access to the diagram'],
    cannot_invite_self: [400, 'You cannot invite yourself'],
    invitation_not_found: [404, 'Invitation not found'],
    invitation_expired: [410, 'This invitation has expired'],
    invitation_email_mismatch: [
        403,
        'This invitation was sent to a different email',
    ],
    query_too_short: [400, 'Search query must have at least 3 characters'],
    invalid_role: [400, 'Invalid role'],
    user_not_found: [404, 'User not found'],
};

export function mapInvitationError(err: unknown): unknown {
    const pg = err as { code?: string; message?: string };
    if (pg?.code !== 'P0001' || !pg.message) return err;
    const known = BUSINESS_ERRORS[pg.message];
    return known ? new AppError(known[0], known[1], pg.message) : err;
}

export async function run<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        throw mapInvitationError(err);
    }
}

const iso = (v: unknown) => new Date(String(v)).toISOString();

function rowToInvitation(r: Record<string, unknown>): InvitationDto {
    return {
        id: String(r.id),
        email: String(r.email),
        role: r.role as InvitationRole,
        status: String(r.status),
        expiresAt: iso(r.expires_at),
        createdAt: iso(r.created_at),
    };
}

export const invitationsService = {
    async create(
        client: PoolClient,
        diagramId: string,
        email: string,
        role: InvitationRole
    ): Promise<{ invitation: InvitationDto; token: string }> {
        const { token, tokenHash } = generateInviteToken();
        const { rows } = await run(() =>
            client.query(
                `SELECT * FROM create_diagram_invitation($1, $2, $3, $4)`,
                [diagramId, email, role, tokenHash]
            )
        );
        return { invitation: rowToInvitation(rows[0]), token };
    },

    async resend(
        client: PoolClient,
        invitationId: string
    ): Promise<{ invitation: InvitationDto; token: string }> {
        const { token, tokenHash } = generateInviteToken();
        const { rows } = await run(() =>
            client.query(`SELECT * FROM resend_diagram_invitation($1, $2)`, [
                invitationId,
                tokenHash,
            ])
        );
        return { invitation: rowToInvitation(rows[0]), token };
    },

    async listForDiagram(
        client: PoolClient,
        diagramId: string
    ): Promise<InvitationDto[]> {
        const { rows } = await run(() =>
            client.query(`SELECT * FROM list_diagram_invitations($1)`, [
                diagramId,
            ])
        );
        return rows.map(rowToInvitation);
    },

    async revoke(client: PoolClient, invitationId: string): Promise<void> {
        await run(() =>
            client.query(`SELECT revoke_diagram_invitation($1)`, [invitationId])
        );
    },

    async listMine(client: PoolClient): Promise<MyInvitationDto[]> {
        const { rows } = await run(() =>
            client.query(`SELECT * FROM list_my_invitations()`)
        );
        return rows.map((r) => ({
            id: String(r.id),
            diagramId: String(r.diagram_id),
            diagramName: String(r.diagram_name),
            role: r.role as InvitationRole,
            expiresAt: iso(r.expires_at),
            createdAt: iso(r.created_at),
            invitedBy: {
                displayName: (r.invited_by_name as string) ?? null,
                avatarUrl: (r.invited_by_avatar as string) ?? null,
            },
        }));
    },

    async accept(client: PoolClient, invitationId: string): Promise<string> {
        const { rows } = await run(() =>
            client.query(`SELECT accept_diagram_invitation($1, $2)`, [
                invitationId,
                null,
            ])
        );
        return String(rows[0].accept_diagram_invitation);
    },

    async acceptByToken(client: PoolClient, token: string): Promise<string> {
        const { rows } = await run(() =>
            client.query(`SELECT accept_diagram_invitation($1, $2)`, [
                null,
                hashInviteToken(token),
            ])
        );
        return String(rows[0].accept_diagram_invitation);
    },

    async decline(client: PoolClient, invitationId: string): Promise<void> {
        await run(() =>
            client.query(`SELECT decline_diagram_invitation($1)`, [
                invitationId,
            ])
        );
    },

    async searchCandidates(
        client: PoolClient,
        diagramId: string,
        query: string
    ): Promise<ShareCandidateDto[]> {
        const { rows } = await run(() =>
            client.query(`SELECT * FROM search_users_for_share($1, $2)`, [
                diagramId,
                query,
            ])
        );
        return rows.map((r) => ({
            userId: String(r.user_id),
            displayName: (r.display_name as string) ?? null,
            avatarUrl: (r.avatar_url as string) ?? null,
            email: String(r.email),
        }));
    },
};
