import type { PoolClient } from 'pg';

// Notificaciones internas (server/sql/2026-09-24-collab-notifications.sql).
// Las crean triggers en Postgres; aquí solo se leen y se marcan como leídas.
// RLS limita todo a las filas del usuario actual.

export interface NotificationDto {
    id: string;
    type: string;
    diagramId: string | null;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
}

const iso = (v: unknown) => new Date(String(v)).toISOString();

export const notificationsService = {
    async list(
        client: PoolClient,
        limit: number
    ): Promise<{ items: NotificationDto[]; unreadCount: number }> {
        const { rows } = await client.query(
            `SELECT id, type, diagram_id, payload, read_at, created_at
             FROM user_notifications
             ORDER BY created_at DESC
             LIMIT $1`,
            [limit]
        );
        const { rows: countRows } = await client.query(
            `SELECT count(*)::int AS unread FROM user_notifications WHERE read_at IS NULL`
        );
        return {
            unreadCount: Number(countRows[0]?.unread ?? 0),
            items: rows.map((r) => ({
                id: String(r.id),
                type: String(r.type),
                diagramId: (r.diagram_id as string) ?? null,
                payload: (r.payload as Record<string, unknown>) ?? {},
                readAt: r.read_at ? iso(r.read_at) : null,
                createdAt: iso(r.created_at),
            })),
        };
    },

    /** Sin `ids`, marca todas las no leídas. */
    async markRead(client: PoolClient, ids: string[] | undefined) {
        if (ids && ids.length > 0) {
            await client.query(
                `UPDATE user_notifications SET read_at = now()
                 WHERE id = ANY($1::uuid[]) AND read_at IS NULL`,
                [ids]
            );
            return;
        }
        await client.query(
            `UPDATE user_notifications SET read_at = now() WHERE read_at IS NULL`,
            []
        );
    },
};
