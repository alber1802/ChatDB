import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// errorHandler importa config/env, que valida variables al cargar.
beforeAll(() => {
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('DATABASE_URL', 'postgres://x');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'x');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'x');
});

const run = async (err: unknown) => {
    const { errorHandler } = await import('../src/middleware/errorHandler.ts');
    const res = {
        statusCode: 0,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(body: unknown) {
            this.body = body;
            return this;
        },
    };
    errorHandler(err, {} as Request, res as unknown as Response, vi.fn());
    return res;
};

// Si el backend se despliega antes de aplicar las migraciones de
// server/sql/, Postgres responde "function/relation does not exist".
// Debe verse como un 503 explícito, no como un 500 genérico.
describe('errorHandler — pending migrations', () => {
    it.each([
        ['42883', 'undefined function'],
        ['42P01', 'undefined table'],
    ])('maps Postgres %s (%s) to 503 migration_pending', async (code) => {
        const res = await run(Object.assign(new Error('x'), { code }));
        expect(res.statusCode).toBe(503);
        expect(res.body).toMatchObject({ error: 'migration_pending' });
    });
});
