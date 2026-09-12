import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './config/db.js';
import { closeRedis, connectRedis } from './config/redis.js';
import { logger } from './lib/logger.js';

const app = createApp();

async function main() {
    await connectRedis();

    const server = app.listen(env.PORT, () => {
        logger.info(
            { port: env.PORT, env: env.NODE_ENV },
            'ChartDB API listening'
        );
    });

    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Shutting down gracefully');
        server.close(async () => {
            try {
                await closePool();
                await closeRedis();
                logger.info('Shutdown complete');
                process.exit(0);
            } catch (err) {
                logger.error({ err }, 'Error during shutdown');
                process.exit(1);
            }
        });

        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000).unref();
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
});
