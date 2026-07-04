/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context/auth-context';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import { Label } from '@/components/label/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/tabs/tabs';
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
    UserPlus,
    CheckCircle,
    ArrowLeft,
    Eye,
    EyeOff,
    Sparkles,
    Database,
    Cloud,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ChartDBDarkLogo from '@/assets/logo-dark.png';

const translateAuthError = (message: string): string => {
    if (message.includes('Invalid login credentials')) {
        return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    }
    if (message.includes('Email not confirmed')) {
        return 'Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.';
    }
    if (message.includes('User already registered')) {
        return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
    }
    if (message.includes('Password should be at least')) {
        return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (message.includes('Unable to validate email address')) {
        return 'El formato del correo electrónico no es válido.';
    }
    if (message.includes('Email rate limit exceeded')) {
        return 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.';
    }
    if (message.includes('signup_disabled')) {
        return 'El registro de nuevos usuarios está temporalmente deshabilitado.';
    }
    return message;
};

export const AuthPage: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (mode === 'login') {
                const { error: authError } = await signIn(email, password);
                if (authError) {
                    setError(translateAuthError(authError.message));
                } else {
                    navigate('/');
                }
            } else {
                const { error: authError } = await signUp(email, password);
                if (authError) {
                    setError(translateAuthError(authError.message));
                } else {
                    setEmailSent(true);
                }
            }
        } catch (err: any) {
            setError(err?.message || 'Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    // ─── Pantalla de confirmación post-registro ────────────────────────────────
    if (emailSent) {
        return (
            <div
                id="auth-container"
                className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 text-[#f3f4f6]"
            >
                <style>{`
                    #auth-container {
                        background-color: hsla(244, 100%, 50%, 1);
                        background-image: radial-gradient(circle at 50% 0%, hsla(319, 0%, 0%, 1) 49.15975941515135%, transparent 102.23193813062571%);
                        background-blend-mode: normal;
                    }
                    .bg-grid-pattern {
                        background-size: 50px 50px;
                        background-image: linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                                          linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
                    }
                `}</style>
                <div className="bg-grid-pattern pointer-events-none absolute inset-0" />
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-[20%] top-[10%] h-[350px] w-[350px] animate-pulse rounded-full bg-blue-600/10 blur-[100px]" />
                    <div className="absolute bottom-[10%] right-[20%] h-[350px] w-[350px] animate-pulse rounded-full bg-emerald-600/10 blur-[100px]" />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="relative z-10 w-full max-w-md"
                >
                    <Card className="rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)] backdrop-blur-xl">
                        <CardContent className="pb-8 pt-10">
                            <div className="flex flex-col items-center space-y-6 text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 200,
                                        damping: 15,
                                        delay: 0.1,
                                    }}
                                    className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-4 ring-emerald-500/20"
                                >
                                    <CheckCircle className="size-11 text-emerald-400" />
                                </motion.div>

                                <div className="space-y-3">
                                    <h2 className="text-2xl font-bold tracking-tight text-white">
                                        ¡Revisa tu correo!
                                    </h2>
                                    <p className="text-sm leading-relaxed text-slate-300">
                                        Hemos enviado un enlace de verificación
                                        a:
                                    </p>
                                    <div className="inline-block rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 shadow-inner">
                                        {email}
                                    </div>
                                    <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
                                        Haz clic en el enlace del correo para
                                        activar tu cuenta y poder iniciar
                                        sesión.
                                    </p>
                                </div>

                                <div className="w-full space-y-4 pt-4">
                                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left">
                                        <p className="text-xs leading-relaxed text-amber-400/90">
                                            <span className="font-semibold text-amber-400">
                                                💡 ¿No lo ves?
                                            </span>{' '}
                                            Revisa tu carpeta de{' '}
                                            <span className="font-semibold">
                                                Spam
                                            </span>{' '}
                                            o{' '}
                                            <span className="font-semibold">
                                                Correo no deseado
                                            </span>
                                            .
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={() => {
                                            setEmailSent(false);
                                            setMode('login');
                                            setPassword('');
                                            setError('');
                                        }}
                                        className="w-full border border-white/10 bg-white/5 text-slate-200 transition-all duration-200 hover:bg-white/10 hover:text-white"
                                    >
                                        <ArrowLeft className="mr-2 size-4" />
                                        Volver al inicio de sesión
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }

    // ─── Pantalla de Login / Registro ─────────────────────────────────────────
    return (
        <div
            id="auth-container"
            className="relative flex min-h-screen w-full items-center justify-center overflow-hidden font-sans text-slate-100"
        >
            <style>{`
                #auth-container {
                    background-color: hsla(244, 100%, 50%, 1);
                    background-image: radial-gradient(circle at 50% 0%, hsla(319, 0%, 0%, 1) 49.15975941515135%, transparent 102.23193813062571%);
                    background-blend-mode: normal;
                }
                .bg-grid-pattern {
                    background-size: 50px 50px;
                    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                                      linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
                }
                .perspective-container {
                    perspective: 1500px;
                }
                .perspective-image {
                    transform-style: preserve-3d;
                    transform: rotateX(8deg) rotateY(-10deg) rotateZ(3deg);
                    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s ease;
                }
                .perspective-image:hover {
                    transform: rotateX(4deg) rotateY(-5deg) rotateZ(1deg) scale(1.02);
                    box-shadow: 0 30px 60px -15px rgba(99, 102, 241, 0.3), 0 0 50px -10px rgba(168, 85, 247, 0.2);
                }
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0px) rotateX(8deg) rotateY(-10deg) rotateZ(3deg);
                    }
                    50% {
                        transform: translateY(-12px) rotateX(10deg) rotateY(-8deg) rotateZ(3.5deg);
                    }
                }
                .animate-float {
                    animation: float 8s ease-in-out infinite;
                }
            `}</style>

            {/* Background elements */}
            <div className="bg-grid-pattern pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
                <div className="absolute bottom-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[130px]" />
            </div>

            {/* Floating background image for mobile/tablet */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden lg:hidden">
                <div className="w-[120%] max-w-lg translate-y-12 -rotate-12 transform opacity-[0.08]">
                    <img
                        src="/chartdb.png"
                        alt="background diagram"
                        className="h-auto w-full"
                    />
                </div>
            </div>

            <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 gap-8 p-4 md:p-8 lg:grid-cols-12 lg:gap-16">
                {/* Left Column: Form Card */}
                <div className="mx-auto flex w-full max-w-md flex-col justify-center lg:col-span-5">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_0_50px_-12px_rgba(168,85,247,0.15)] backdrop-blur-xl">
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
                                    {mode === 'login'
                                        ? 'Ingresa tus credenciales para acceder a tus diagramas'
                                        : 'Crea tu cuenta para guardar tus diagramas en la nube'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs
                                    value={mode}
                                    onValueChange={(val) => {
                                        setMode(val as any);
                                        setError('');
                                    }}
                                    className="w-full"
                                >
                                    <TabsList className="grid w-full grid-cols-2 rounded-xl border border-white/5 bg-slate-900/60 p-1">
                                        <TabsTrigger
                                            value="login"
                                            className="rounded-lg py-1.5 text-slate-400 transition-all duration-300 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg"
                                        >
                                            Iniciar Sesión
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="register"
                                            className="rounded-lg py-1.5 text-slate-400 transition-all duration-300 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg"
                                        >
                                            Registrarse
                                        </TabsTrigger>
                                    </TabsList>

                                    <form
                                        onSubmit={handleSubmit}
                                        className="mt-6"
                                    >
                                        <motion.div
                                            key={mode}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-4"
                                        >
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
                                                            setEmail(
                                                                e.target.value
                                                            )
                                                        }
                                                        required
                                                        className="h-10 border-white/10 bg-slate-900/40 pl-10 text-white placeholder-slate-500 transition-all duration-200 hover:bg-slate-900/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label
                                                    htmlFor="password"
                                                    className="flex items-center justify-between text-xs font-semibold text-slate-300"
                                                >
                                                    <span>Contraseña</span>
                                                    {mode === 'register' && (
                                                        <span className="text-[10px] font-normal text-slate-500">
                                                            (mínimo 6
                                                            caracteres)
                                                        </span>
                                                    )}
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
                                                        minLength={6}
                                                        className="h-10 border-white/10 bg-slate-900/40 px-10 text-white placeholder-slate-500 transition-all duration-200 hover:bg-slate-900/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
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

                                            {error && (
                                                <motion.div
                                                    initial={{
                                                        opacity: 0,
                                                        scale: 0.95,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        scale: 1,
                                                    }}
                                                    className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-400"
                                                >
                                                    {error}
                                                </motion.div>
                                            )}

                                            {mode === 'register' && !error && (
                                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                                                    📧 Después de registrarte,
                                                    recibirás un correo de
                                                    verificación para activar tu
                                                    cuenta.
                                                </div>
                                            )}

                                            <Button
                                                type="submit"
                                                disabled={loading}
                                                className="mt-2 h-10 w-full transform border-none bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:from-blue-500 hover:via-indigo-500 hover:to-emerald-500 hover:shadow-indigo-500/35 active:scale-[0.98]"
                                            >
                                                {loading ? (
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
                                                            ></circle>
                                                            <path
                                                                className="opacity-75"
                                                                fill="currentColor"
                                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                            ></path>
                                                        </svg>
                                                        Procesando...
                                                    </span>
                                                ) : mode === 'login' ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <LogIn className="size-4" />{' '}
                                                        Iniciar Sesión
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <UserPlus className="size-4" />{' '}
                                                        Crear Cuenta
                                                    </span>
                                                )}
                                            </Button>
                                        </motion.div>
                                    </form>
                                </Tabs>
                            </CardContent>
                            <CardFooter className="mt-4 flex flex-col space-y-3 border-t border-white/5 pt-4 text-center text-xs text-slate-500">
                                <span>
                                    Los diagramas se guardarán cifrados en
                                    Supabase Cloud.
                                </span>
                                <div className="flex justify-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/')}
                                        className="font-medium text-blue-400 transition-colors hover:text-blue-300 hover:underline"
                                    >
                                        Usar almacenamiento local temporal
                                        (IndexedDB)
                                    </button>
                                </div>
                            </CardFooter>
                        </Card>
                    </motion.div>
                </div>

                {/* Right Column: Schema Showcase */}
                <div className="relative hidden flex-col items-center justify-center pl-8 lg:col-span-7 lg:flex">
                    {/* Tagline */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="z-10 mb-8 w-full max-w-xl text-left"
                    >
                        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-purple-300 shadow-sm backdrop-blur-sm">
                            <Sparkles className="size-3.5 text-purple-400" />
                            <span>Editor de Diagramas Cloud</span>
                        </div>
                        <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white">
                            Diseña y visualiza tu base de datos{' '}
                            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                de forma instantánea.
                            </span>
                        </h2>
                        <p className="max-w-lg leading-relaxed text-slate-300">
                            Dibuja tus diagramas de relación de bases de datos,
                            visualiza esquemas mediante queries SQL y exporta
                            scripts DDL de forma interactiva y segura.
                        </p>
                    </motion.div>

                    {/* 3D Tilted Schema Image Showcase */}
                    <div className="perspective-container relative z-10 w-full max-w-xl select-none">
                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 opacity-40 blur-2xl" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="perspective-image animate-float overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-2.5 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur-sm"
                        >
                            <img
                                src="/chartdb.png"
                                alt="ChartDB Editor Preview"
                                className="h-auto w-full rounded-xl border border-white/5 shadow-inner duration-1000 animate-in fade-in-25"
                            />
                        </motion.div>

                        {/* Floating badges on the 3D showcase */}
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="absolute -left-6 -top-4 flex -rotate-3 transform items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 p-3 shadow-lg backdrop-blur-md transition-transform duration-200 hover:rotate-0"
                        >
                            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
                                <Database className="size-4 text-blue-400" />
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    Multi-db
                                </div>
                                <div className="text-xs font-semibold text-white">
                                    Postgres, MySQL, SQL Server
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            className="absolute -bottom-5 -right-6 flex rotate-2 transform items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 p-3 shadow-lg backdrop-blur-md transition-transform duration-200 hover:rotate-0"
                        >
                            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                                <Cloud className="size-4 text-emerald-400" />
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    Sincronización
                                </div>
                                <div className="text-xs font-semibold text-white">
                                    Diagramas en la nube
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};
