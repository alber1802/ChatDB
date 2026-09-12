/**
 * Isolation regression tests.
 *
 * These run only when INTEGRATION=1 and credentials are available.
 * They verify that user A cannot read/update user B's diagrams via the API
 * (RLS + JWT impersonation).
 *
 * Required env:
 *   INTEGRATION=1
 *   TEST_USER_A_JWT
 *   TEST_USER_B_JWT
 *   TEST_USER_B_DIAGRAM_ID
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

describe.skipIf(!enabled)('user isolation', () => {
    const tokenA = process.env.TEST_USER_A_JWT!;
    const tokenB = process.env.TEST_USER_B_JWT!;
    const diagramB = process.env.TEST_USER_B_DIAGRAM_ID!;

    it('user A cannot read user B diagram', async () => {
        const res = await api(`/diagrams/${diagramB}`, tokenA);
        // Either 404 (RLS filters to zero) or 403
        expect([403, 404]).toContain(res.status);
    });

    it('user A cannot patch user B diagram', async () => {
        const res = await api(`/diagrams/${diagramB}`, tokenA, {
            method: 'PATCH',
            body: JSON.stringify({ name: 'hacked' }),
        });
        expect([403, 404]).toContain(res.status);
    });

    it('user B can read own diagram', async () => {
        const res = await api(`/diagrams/${diagramB}`, tokenB);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { id: string };
        expect(body.id).toBe(diagramB);
    });
});
