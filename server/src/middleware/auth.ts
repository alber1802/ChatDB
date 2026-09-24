import type { RequestHandler } from 'express';
import { AppError, type AuthUser } from '../lib/types.js';
import { verifyAccessToken } from '../lib/jwt.js';

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
        const { id, role } = await verifyAccessToken(token);
        req.user = { id, role };
        next();
    } catch {
        next(new AppError(401, 'Invalid or expired token', 'invalid_token'));
    }
};
