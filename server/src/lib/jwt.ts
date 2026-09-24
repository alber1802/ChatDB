import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type { AuthUser } from './types.js';

interface JwtPayload {
    sub: string;
    role?: string;
    exp?: number;
}

// Supabase signs session tokens with its rotating JWT signing keys (ES256),
// published as a JWKS — not the legacy shared HS256 secret.
const jwks = createRemoteJWKSet(
    new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL)
);

export interface VerifiedToken extends AuthUser {
    /** Expiración (epoch en segundos), para cortar sockets con token vencido. */
    exp?: number;
}

/** Verifica un JWT de sesión de Supabase. Lanza si es inválido o expiró. */
export async function verifyAccessToken(token: string): Promise<VerifiedToken> {
    const { payload } = (await jwtVerify(token, jwks, {
        issuer: new URL('/auth/v1', env.SUPABASE_URL).toString(),
    })) as { payload: JwtPayload };
    if (!payload.sub) throw new Error('Invalid token payload');
    return {
        id: payload.sub,
        role: payload.role ?? 'authenticated',
        exp: payload.exp,
    };
}
