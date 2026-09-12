import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { AppError, type AuthUser } from '../lib/types.js';

interface JwtPayload {
    sub: string;
    role?: string;
    aud?: string;
}

declare global {
    // Express's own type augmentation pattern requires a namespace here;
    // there is no ES2015-module equivalent for merging into an ambient
    // global namespace.
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

// Supabase signs session tokens with its rotating JWT signing keys (ES256),
// published as a JWKS — not the legacy shared HS256 secret.
const jwks = createRemoteJWKSet(
    new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL)
);

export const authenticate: RequestHandler = async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return next(new AppError(401, 'Missing bearer token', 'missing_token'));
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return next(new AppError(401, 'Missing bearer token', 'missing_token'));
    }

    try {
        const { payload } = (await jwtVerify(token, jwks, {
            issuer: new URL('/auth/v1', env.SUPABASE_URL).toString(),
        })) as { payload: JwtPayload };

        if (!payload.sub) {
            return next(new AppError(401, 'Invalid token payload', 'invalid_token'));
        }

        req.user = {
            id: payload.sub,
            role: payload.role ?? 'authenticated',
        };
        next();
    } catch {
        next(new AppError(401, 'Invalid or expired token', 'invalid_token'));
    }
};
