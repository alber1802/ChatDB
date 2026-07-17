import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context/auth-context';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import { Label } from '@/components/label/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import {
    Mail,
    Lock,
    LogIn,
    Eye,
    EyeOff,
    ShieldAlert,
    Clock,
    Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { translateAuthError } from './utils';
import { notify } from '@/lib/notifications';
import { WaitlistModal } from './waitlist-modal';

interface AuthCardProps {
    onLoginSuccess: () => void;
}

/** Format seconds as MM:SS */
const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export const AuthCard: React.FC<AuthCardProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [countdownSeconds, setCountdownSeconds] = useState(0);
    const [waitlistOpen, setWaitlistOpen] = useState(false);

    // Email-specific reactive states
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);

    const { signIn } = useAuth();

    const syncEmailStatus = useCallback(
        (emailVal: string) => {
            const cleanEmail = emailVal.trim().toLowerCase();
            if (!cleanEmail) {
                setLoginAttempts(0);
                setIsLockedOut(false);
                setLockoutUntil(null);
                return;
            }

            const storedAttempts = parseInt(
                localStorage.getItem(`attempts_${cleanEmail}`) || '0',
                10
            );
            setLoginAttempts(storedAttempts);

            const isBlocked =
                localStorage.getItem(`blocked_${cleanEmail}`) === 'true';
            if (isBlocked) {
                setError(
                    'Tu cuenta ha sido bloqueada por el administrador. Contacta al soporte para recuperar el acceso.'
                );
            } else if (
                error.includes('bloqueada') ||
                error.includes('administrador') ||
                error.includes('intentos')
            ) {
                setError('');
            }

            const cooldownStr = localStorage.getItem(`cooldown_${cleanEmail}`);
            if (cooldownStr) {
                const until = new Date(cooldownStr);
                if (until.getTime() > Date.now()) {
                    setIsLockedOut(true);
                    setLockoutUntil(until);
                    return;
                } else {
                    localStorage.removeItem(`cooldown_${cleanEmail}`);
                }
            }
            setIsLockedOut(false);
            setLockoutUntil(null);
        },
        [error]
    );

    // Keep state in sync with typed email
    useEffect(() => {
        syncEmailStatus(email);
    }, [email, syncEmailStatus]);

    // ── Countdown timer while in cooldown ──────────────────────────────────
    useEffect(() => {
        if (!isLockedOut || !lockoutUntil) {
            setCountdownSeconds(0);
            return;
        }

        const update = () => {
            const remaining = Math.max(
                0,
                Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000)
            );
            setCountdownSeconds(remaining);
            if (remaining <= 0) {
                setIsLockedOut(false);
                setLockoutUntil(null);
                const cleanEmail = email.trim().toLowerCase();
                localStorage.removeItem(`cooldown_${cleanEmail}`);
            }
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [isLockedOut, lockoutUntil, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLockedOut || submitting) return;

        setSubmitting(true);
        setError('');

        const { error: authError } = await signIn(email, password);

        // Sync local UI states immediately after login try
        syncEmailStatus(email);

        if (authError) {
            const msg = translateAuthError(authError.message);
            setError(msg);

            const isBlockedMsg =
                msg.includes('bloqueada') ||
                msg.includes('intentos') ||
                msg.includes('administrador');
            if (isBlockedMsg) {
                notify.error('Acceso bloqueado', msg);
            } else {
                notify.warning('Intento fallido', msg);
            }
        } else {
            notify.success('¡Bienvenido!', 'Sesión iniciada correctamente.');
            onLoginSuccess();
        }

        setSubmitting(false);
    };

    // ── Derived visual state ───────────────────────────────────────────────
    const isPermanentlyBlocked = error.includes('administrador');
    const attemptsInCurrentRound = loginAttempts % 3;
    const showAttemptWarning =
        attemptsInCurrentRound > 0 && !isLockedOut && !isPermanentlyBlocked;

    return (
        <>
            <div className="mx-auto flex w-full max-w-md flex-col justify-center lg:col-span-5">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    <Card className="dark overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_0_50px_-12px_rgba(168,85,247,0.15)] backdrop-blur-xl">
                        <CardHeader className="space-y-2 pb-4 pt-6 text-center">
                            <div className="mx-auto mb-2 flex items-center justify-center">
                                <img
                                    src={ChartDBDarkLogo}
                                    alt="ChartDB Logo"
                                    className="h-6 w-auto"
                                />
                            </div>
                            <CardTitle className="text-2xl font-bold tracking-tight text-white duration-300 animate-in fade-in slide-in-from-bottom-1">
                                ¡Bienvenido!
                            </CardTitle>
                            <CardDescription className="text-sm text-slate-400">
                                Ingresa tus credenciales para acceder a tus
                                diagramas
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            {/* ── Permanent block state ── */}
                            <AnimatePresence mode="wait">
                                {isPermanentlyBlocked ? (
                                    <motion.div
                                        key="blocked"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center gap-3 py-6 text-center"
                                    >
                                        <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
                                            <ShieldAlert className="size-7 text-red-400" />
                                        </div>
                                        <p className="text-sm font-medium text-red-300">
                                            Cuenta bloqueada
                                        </p>
                                        <p className="max-w-xs text-xs leading-relaxed text-slate-400">
                                            {error}
                                        </p>
                                    </motion.div>
                                ) : (
                                    /* ── Login form ── */
                                    <motion.form
                                        key="form"
                                        onSubmit={handleSubmit}
                                        className="space-y-4"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        {/* Email field */}
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="email"
                                                className="text-xs font-semibold text-slate-300"
                                            >
                                                Correo Electrónico
                                            </Label>
                                            <div className="group relative">
                                                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-blue-400" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="correo@ejemplo.com"
                                                    value={email}
                                                    onChange={(e) =>
                                                        setEmail(e.target.value)
                                                    }
                                                    required
                                                    disabled={isLockedOut}
                                                    className="h-10 border-white/10 bg-slate-900/40 pl-10 text-white placeholder-slate-500 transition-all duration-200 hover:bg-slate-900/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* Password field */}
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="password"
                                                className="text-xs font-semibold text-slate-300"
                                            >
                                                Contraseña
                                            </Label>
                                            <div className="group relative">
                                                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-blue-400" />
                                                <Input
                                                    id="password"
                                                    type={
                                                        showPassword
                                                            ? 'text'
                                                            : 'password'
                                                    }
                                                    placeholder="••••••••"
                                                    value={password}
                                                    onChange={(e) =>
                                                        setPassword(
                                                            e.target.value
                                                        )
                                                    }
                                                    required
                                                    disabled={isLockedOut}
                                                    className="h-10 border-white/10 bg-slate-900/40 px-10 text-white placeholder-slate-500 transition-all duration-200 hover:bg-slate-900/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowPassword(
                                                            !showPassword
                                                        )
                                                    }
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-none"
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="size-4" />
                                                    ) : (
                                                        <Eye className="size-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* ── Cooldown banner ── */}
                                        <AnimatePresence>
                                            {isLockedOut && (
                                                <motion.div
                                                    initial={{
                                                        opacity: 0,
                                                        height: 0,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        height: 'auto',
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        height: 0,
                                                    }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                                                        <Clock className="size-4 shrink-0 text-amber-400" />
                                                        <div className="flex-1 text-xs text-amber-300">
                                                            Demasiados intentos.
                                                            Espera{' '}
                                                            <span className="font-mono font-bold">
                                                                {formatCountdown(
                                                                    countdownSeconds
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* ── Attempt warning ── */}
                                        <AnimatePresence>
                                            {showAttemptWarning && (
                                                <motion.div
                                                    initial={{
                                                        opacity: 0,
                                                        scale: 0.95,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        scale: 1,
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        scale: 0.95,
                                                    }}
                                                    className="bg-orange-500/8 rounded-lg border border-orange-500/25 p-3 text-xs leading-relaxed text-orange-300"
                                                >
                                                    ⚠️ Intento{' '}
                                                    {attemptsInCurrentRound} de
                                                    3 —{' '}
                                                    {3 - attemptsInCurrentRound}{' '}
                                                    restante
                                                    {3 -
                                                        attemptsInCurrentRound !==
                                                    1
                                                        ? 's'
                                                        : ''}{' '}
                                                    antes del bloqueo temporal.
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* ── Generic error ── */}
                                        <AnimatePresence>
                                            {error &&
                                                !isLockedOut &&
                                                !isPermanentlyBlocked && (
                                                    <motion.div
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.95,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                        }}
                                                        exit={{ opacity: 0 }}
                                                        className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-400"
                                                    >
                                                        {error}
                                                    </motion.div>
                                                )}
                                        </AnimatePresence>

                                        {/* ── Submit button ── */}
                                        <Button
                                            type="submit"
                                            disabled={submitting || isLockedOut}
                                            className="mt-2 h-10 w-full transform border-none bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:from-blue-500 hover:via-indigo-500 hover:to-emerald-500 hover:shadow-indigo-500/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {submitting ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg
                                                        className="size-4 animate-spin text-white"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        />
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                        />
                                                    </svg>
                                                    Verificando...
                                                </span>
                                            ) : isLockedOut ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <Clock className="size-4" />
                                                    Bloqueado temporalmente
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-2">
                                                    <LogIn className="size-4" />
                                                    Iniciar Sesión
                                                </span>
                                            )}
                                        </Button>
                                    </motion.form>
                                )}
                            </AnimatePresence>
                        </CardContent>

                        <CardFooter className="mt-2 flex flex-col gap-3 border-t border-white/5 pt-4">
                            {/* ── Waitlist CTA ── */}
                            <button
                                type="button"
                                onClick={() => setWaitlistOpen(true)}
                                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2.5 text-sm font-medium text-indigo-300 transition-all duration-200 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-200"
                            >
                                <Sparkles className="size-4 transition-transform group-hover:scale-110" />
                                ¿No tienes acceso? Únete a la lista de espera
                            </button>

                            {/* ── Local storage fallback ── 
                            <div className="text-center text-xs text-slate-500">
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="font-medium text-blue-400 transition-colors hover:text-blue-300 hover:underline"
                                >
                                    Usar almacenamiento local temporal
                                    (IndexedDB)
                                </button>
                            </div>*/}
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>

            {/* ── Waitlist modal ── */}
            <WaitlistModal
                isOpen={waitlistOpen}
                onClose={() => setWaitlistOpen(false)}
            />
        </>
    );
};
