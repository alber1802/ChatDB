import { Router } from 'express';
import { env } from '../../config/env.js';
import { loginSchema } from '../../lib/schemas.js';
import { AppError } from '../../lib/types.js';
import { loginRateLimit } from '../../middleware/rateLimit.js';
import {
    clearLoginLockState,
    getLoginLockState,
    isUserBlockedByEmail,
    recordFailedLogin,
} from './login-lockout.js';
import { withUserContext } from '../../config/db.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const email = body.email.trim().toLowerCase();

        const blocked = await isUserBlockedByEmail(email);
        if (blocked) {
            throw new AppError(
                403,
                'Tu cuenta ha sido bloqueada por el administrador. Contacta al soporte para recuperar el acceso.',
                'blocked'
            );
        }

        const lock = await getLoginLockState(email);
        if (lock.cooldownUntil && lock.cooldownUntil > Date.now()) {
            const remaining = Math.ceil(
                (lock.cooldownUntil - Date.now()) / 1000
            );
            throw new AppError(
                429,
                `Demasiados intentos. Espera ${remaining} segundos antes de intentarlo de nuevo.`,
                'cooldown'
            );
        }

        const authRes = await fetch(
            `${env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
            {
                method: 'POST',
                headers: {
                    apikey: env.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password: body.password,
                }),
            }
        );

        if (!authRes.ok) {
            const fail = await recordFailedLogin(
                email,
                req.ip,
                req.get('user-agent') ?? undefined
            );
            if (fail.blocked) {
                throw new AppError(403, fail.message ?? 'Blocked', 'blocked');
            }
            if (fail.message && fail.cooldownUntil) {
                throw new AppError(429, fail.message, 'cooldown');
            }
            throw new AppError(
                401,
                'Invalid login credentials',
                'invalid_credentials'
            );
        }

        const session = (await authRes.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            token_type: string;
            user: { id: string; email?: string };
        };

        await clearLoginLockState(email);

        // Double-check is_blocked after successful auth
        const stillBlocked = await withUserContext(
            session.user.id,
            async (client) => {
                const { rows } = await client.query(
                    `SELECT is_blocked FROM user_profiles WHERE user_id = $1`,
                    [session.user.id]
                );
                return Boolean(rows[0]?.is_blocked);
            }
        );

        if (stillBlocked) {
            throw new AppError(
                403,
                'Tu cuenta ha sido bloqueada por el administrador. Contacta al soporte para recuperar el acceso.',
                'blocked'
            );
        }

        res.json({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            token_type: session.token_type,
            user: session.user,
        });
    } catch (err) {
        next(err);
    }
});
