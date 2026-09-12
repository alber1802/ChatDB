/**
 * Requiere INTEGRATION=1 y las mismas variables que isolation.test.ts,
 * más TEST_USER_B_TABLE_ID (una fila existente en TEST_USER_B_DIAGRAM_ID).
 */
import { describe, expect, it } from 'vitest';

const enabled = process.env.INTEGRATION === '1';
const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';

async function api(
    path: string,
    token: string,
    init: RequestInit = {}
): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });
}

describe.skipIf(!enabled)('sync endpoint', () => {
    const tokenB = process.env.TEST_USER_B_JWT!;
    const diagramB = process.env.TEST_USER_B_DIAGRAM_ID!;
    const tableId = process.env.TEST_USER_B_TABLE_ID!;

    it('applies a batch and bumps the version', async () => {
        const before = await api(`/diagrams/${diagramB}`, tokenB);
        const { version } = (await before.json()) as { version: number };

        const res = await api(`/diagrams/${diagramB}/sync`, tokenB, {
            method: 'POST',
            body: JSON.stringify({
                baseVersion: version,
                operations: [
                    { entity: 'table', op: 'update', id: tableId, patch: { x: 999 } },
                ],
            }),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            version: number;
            conflicts: unknown[];
        };
        expect(body.version).toBe(version + 1);
        expect(body.conflicts).toEqual([]);
    });

    it('reports a conflict when baseVersion is stale', async () => {
        const res = await api(`/diagrams/${diagramB}/sync`, tokenB, {
            method: 'POST',
            body: JSON.stringify({
                baseVersion: 1,
                operations: [
                    { entity: 'table', op: 'update', id: tableId, patch: { x: 1 } },
                ],
            }),
        });
        const body = (await res.json()) as { conflicts: unknown[] };
        expect(body.conflicts.length).toBeGreaterThan(0);
    });

    it('rejects a batch for another user\'s diagram', async () => {
        const tokenA = process.env.TEST_USER_A_JWT!;
        const res = await api(`/diagrams/${diagramB}/sync`, tokenA, {
            method: 'POST',
            body: JSON.stringify({
                baseVersion: 1,
                operations: [
                    { entity: 'table', op: 'update', id: tableId, patch: { x: 1 } },
                ],
            }),
        });
        expect([403, 404]).toContain(res.status);
    });
});
