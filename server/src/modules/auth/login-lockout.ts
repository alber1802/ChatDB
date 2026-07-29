import { getRedis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { withAnonContext } from '../../config/db.js';

type LockState = {
    attempts: number;
    cooldownUntil: number | null;
};

const memory = new Map<string, LockState>();

function key(email: string) {
    return `login_fail:${email}`;
}

export async function getLoginLockState(email: string): Promise<LockState> {
    const redis = getRedis();
    if (redis) {
        const raw = await redis.get(key(email));
        if (!raw) return { attempts: 0, cooldownUntil: null };
        return JSON.parse(raw) as LockState;
    }
    return memory.get(email) ?? { attempts: 0, cooldownUntil: null };
}

export async function setLoginLockState(
    email: string,
    state: LockState
): Promise<void> {
    const redis = getRedis();
    if (redis) {
        await redis.set(key(email), JSON.stringify(state), 'EX', 60 * 60 * 24);
        return;
    }
    memory.set(email, state);
}

export async function clearLoginLockState(email: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
        await redis.del(key(email));
        return;
    }
    memory.delete(email);
}

export async function isUserBlockedByEmail(email: string): Promise<boolean> {
    return withAnonContext(async (client) => {
        const { rows } = await client.query(
            `SELECT check_user_blocked_by_email($1) AS blocked`,
            [email]
        );
        return Boolean(rows[0]?.blocked);
    });
}

export async function recordFailedLogin(
    email: string,
    ip?: string,
    userAgent?: string
): Promise<{
    blocked: boolean;
    cooldownUntil: number | null;
    attempts: number;
    message?: string;
}> {
    await withAnonContext(async (client) => {
        await client.query(
            `INSERT INTO login_attempts (email, attempted_at, ip_address, user_agent)
             VALUES ($1, NOW(), $2, $3)`,
            [email, ip ?? null, userAgent ?? null]
        );
    });

    const state = await getLoginLockState(email);
    const attempts = state.attempts + 1;
    let cooldownUntil = state.cooldownUntil;
    let blocked = false;
    let message: string | undefined;

    if (attempts >= env.LOGIN_ATTEMPTS_BEFORE_BLOCK) {
        await withAnonContext(async (client) => {
            await client.query(`SELECT block_user_by_email($1)`, [email]);
        });
        blocked = true;
        message =
            'Tu cuenta ha sido bloqueada por superar el límite de intentos fallidos. Un administrador debe desbloquearte.';
        await clearLoginLockState(email);
        return { blocked, cooldownUntil: null, attempts: 0, message };
    }

    if (attempts % env.LOGIN_ATTEMPTS_BEFORE_COOLDOWN === 0) {
        cooldownUntil = Date.now() + env.LOGIN_COOLDOWN_MS;
        message = `Demasiados intentos. Espera ${Math.ceil(env.LOGIN_COOLDOWN_MS / 1000)} segundos antes de intentarlo de nuevo.`;
    }

    await setLoginLockState(email, { attempts, cooldownUntil });
    return { blocked, cooldownUntil, attempts, message };
}
