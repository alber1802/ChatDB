import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/types.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
    next(new AppError(404, 'Not found', 'not_found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: 'validation_error',
            message: 'Invalid request payload',
            details: err.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
            })),
        });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.code ?? 'app_error',
            message: err.message,
        });
    }

    // Postgres errors
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === '42501') {
        return res.status(403).json({
            error: 'forbidden',
            message: 'Permission denied',
        });
    }
    if (pgCode === 'P0001') {
        // RAISE EXCEPTION from SECURITY DEFINER functions (e.g. get_admin_users)
        return res.status(403).json({
            error: 'forbidden',
            message: (err as Error).message || 'Not authorized',
        });
    }

    logger.error({ err }, 'Unhandled error');

    return res.status(500).json({
        error: 'internal_error',
        message:
            env.NODE_ENV === 'production'
                ? 'Internal server error'
                : (err as Error)?.message ?? 'Internal server error',
    });
};
