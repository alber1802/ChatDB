import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
        paths: [
            'req.headers.authorization',
            'password',
            'email',
            'DATABASE_URL',
            'SUPABASE_JWT_SECRET',
            'SUPABASE_ANON_KEY',
        ],
        remove: true,
    },
});
