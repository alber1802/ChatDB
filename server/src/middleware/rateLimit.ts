import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RequestHandler } from 'express';
import { getRedis } from '../config/redis.js';
import { env } from '../config/env.js';

function buildStore(prefix: string) {
    const redis = getRedis();
    if (!redis) return undefined;
    return new RedisStore({
        prefix,
        // ioredis sendCommand compatibility
        sendCommand: (...args: string[]) =>
            redis.call(...(args as [string, ...string[]])) as Promise<number>,
    });
}

export const globalRateLimit: RequestHandler = rateLimit({
    windowMs: 60_000,
    max: env.NODE_ENV === 'production' ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore('rl:global:'),
    message: { error: 'rate_limited', message: 'Too many requests' },
});

// Límites por usuario autenticado (requieren `authenticate` antes).
const byUser = (req: Parameters<RequestHandler>[0]) =>
    req.user?.id ?? req.ip ?? 'anonymous';

export const shareSearchRateLimit: RequestHandler = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: byUser,
    store: buildStore('rl:share-search:'),
    message: { error: 'rate_limited', message: 'Too many searches' },
});

export const invitationCreateRateLimit: RequestHandler = rateLimit({
    windowMs: 60 * 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: byUser,
    store: buildStore('rl:invite:'),
    message: { error: 'rate_limited', message: 'Too many invitations' },
});

export const loginRateLimit: RequestHandler = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore('rl:login:'),
    message: {
        error: 'rate_limited',
        message: 'Too many login attempts from this IP',
    },
});
