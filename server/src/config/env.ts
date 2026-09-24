import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    CORS_ORIGIN: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    SUPABASE_JWT_SECRET: z.string().min(1),
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    REDIS_URL: z.string().optional().default(''),
    // Invitaciones (Fase 2 de colaboración). Sin RESEND_API_KEY/MAIL_FROM no
    // se envían correos y el owner copia el enlace desde el modal.
    RESEND_API_KEY: z.string().optional().default(''),
    MAIL_FROM: z.string().optional().default(''),
    // URL pública del frontend para construir los enlaces /invite/:token.
    // Por defecto, el primer origen de CORS_ORIGIN.
    APP_URL: z.preprocess(
        (v) => (v === '' ? undefined : v),
        z.string().url().optional()
    ),
    LOGIN_ATTEMPTS_BEFORE_COOLDOWN: z.coerce
        .number()
        .int()
        .positive()
        .default(3),
    LOGIN_COOLDOWN_MS: z.coerce.number().int().positive().default(60_000),
    LOGIN_ATTEMPTS_BEFORE_BLOCK: z.coerce.number().int().positive().default(9),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const details = parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new Error(`Invalid environment configuration: ${details}`);
    }
    return parsed.data;
}

export const env = loadEnv();
