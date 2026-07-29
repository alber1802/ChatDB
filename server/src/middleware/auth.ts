import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, type AuthUser } from '../lib/types.js';

interface JwtPayload {
    sub: string;
    role?: string;
    aud?: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export const authenticate: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return next(new AppError(401, 'Missing bearer token', 'missing_token'));
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return next(new AppError(401, 'Missing bearer token', 'missing_token'));
    }

    try {
        const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
            algorithms: ['HS256'],
        }) as JwtPayload;

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
