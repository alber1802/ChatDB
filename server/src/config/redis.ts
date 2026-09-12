import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../lib/logger.js';

let redis: InstanceType<typeof Redis> | null = null;

export function getRedis(): InstanceType<typeof Redis> | null {
    if (!env.REDIS_URL) return null;
    if (!redis) {
        redis = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
            lazyConnect: true,
        });
        redis.on('error', (err: Error) => {
            logger.error({ err }, 'Redis error');
        });
    }
    return redis;
}

export async function connectRedis(): Promise<void> {
    const client = getRedis();
    if (!client) {
        logger.info(
            'REDIS_URL not set — using in-memory rate limit / lockout store'
        );
        return;
    }
    await client.connect();
    logger.info('Connected to Redis');
}

export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}
