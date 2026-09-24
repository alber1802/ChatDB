import type { PoolClient } from 'pg';
import { AppError } from '../../lib/types.js';

export type ShareRole = 'editor' | 'viewer';

export interface ShareDto {
    id: string;
    diagramId: string;
    ownerId: string;
    sharedWith: string;
    role: ShareRole;
    createdAt: string;
    displayName: string | null;
    avatarUrl: string | null;
}

function rowToShare(r: Record<string, unknown>): ShareDto {
    return {
        id: String(r.id),
        diagramId: String(r.diagram_id),
        ownerId: String(r.owner_id),
        sharedWith: String(r.shared_with),
        role: r.role as ShareRole,
        createdAt: new Date(String(r.created_at)).toISOString(),
        displayName: (r.display_name as string) ?? null,
        avatarUrl: (r.avatar_url as string) ?? null,
    };
}

// Autorización en RLS (server/sql/2026-09-23-collab-roles.sql): cualquier
// miembro ve la lista; solo el owner cambia roles o revoca; cada miembro puede
// borrar su propia fila (abandonar). Un 0 en rowCount significa "no existe o
// no tienes permiso" — RLS no distingue, así que se responde 404 en ambos.
export const sharesService = {
    async list(client: PoolClient, diagramId: string): Promise<ShareDto[]> {
        const { rows } = await client.query(
            `SELECT ds.id, ds.diagram_id, ds.owner_id, ds.shared_with, ds.role,
                    ds.created_at, up.display_name, up.avatar_url
             FROM diagram_shares ds
             LEFT JOIN user_profiles up ON up.user_id = ds.shared_with
             WHERE ds.diagram_id = $1
             ORDER BY ds.created_at ASC`,
            [diagramId]
        );
        return rows.map(rowToShare);
    },

    async updateRole(
        client: PoolClient,
        diagramId: string,
        shareId: string,
        role: ShareRole
    ): Promise<void> {
        const { rowCount } = await client.query(
            `UPDATE diagram_shares SET role = $3, updated_at = now()
             WHERE diagram_id = $1 AND id = $2`,
            [diagramId, shareId, role]
        );
        if (!rowCount) throw new AppError(404, 'Share not found', 'not_found');
    },

    async remove(
        client: PoolClient,
        diagramId: string,
        shareId: string
    ): Promise<void> {
        const { rowCount } = await client.query(
            `DELETE FROM diagram_shares WHERE diagram_id = $1 AND id = $2`,
            [diagramId, shareId]
        );
        if (!rowCount) throw new AppError(404, 'Share not found', 'not_found');
    },

    async leave(
        client: PoolClient,
        diagramId: string,
        userId: string
    ): Promise<void> {
        const { rowCount } = await client.query(
            `DELETE FROM diagram_shares WHERE diagram_id = $1 AND shared_with = $2`,
            [diagramId, userId]
        );
        if (!rowCount) throw new AppError(404, 'Share not found', 'not_found');
    },
};
