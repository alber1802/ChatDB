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
    KeyRound,
    Mail,
    Lock,
    LogIn,
    UserPlus,
    CheckCircle,
    ArrowLeft,
} from 'lucide-react';

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
                    // Registro exitoso: mostrar pantalla de verificación de email
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
            <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#090b10] px-4 py-12 text-[#f3f4f6]">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
                    <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-600/10 blur-[120px]" />
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl backdrop-blur-md">
                        <CardContent className="pb-8 pt-10">
                            <div className="flex flex-col items-center space-y-5 text-center">
                                {/* Icono animado */}
                                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20">
                                    <CheckCircle className="size-9 text-emerald-400" />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-white">
                                        ¡Revisa tu correo!
                                    </h2>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        Hemos enviado un enlace de verificación
                                        a:
                                    </p>
                                    <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300">
                                        {email}
                                    </p>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        Haz clic en el enlace del correo para
                                        activar tu cuenta y poder iniciar
                                        sesión.
                                    </p>
                                </div>

                                <div className="w-full space-y-3 pt-2">
                                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-left">
                                        <p className="text-xs text-amber-400">
                                            <span className="font-semibold">
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
                                        className="w-full border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                                    >
                                        <ArrowLeft className="mr-2 size-4" />
                                        Volver al inicio de sesión
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // ─── Pantalla de Login / Registro ─────────────────────────────────────────
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#090b10] px-4 py-12 text-[#f3f4f6]">
            {/* Background dynamic radial gradients */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-600/10 blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-500 to-emerald-500 shadow-lg shadow-blue-500/20">
                        <KeyRound className="size-6 text-white" />
                    </div>
                    <h1 className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                        ChatDB Cloud
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Sincroniza tus diagramas de base de datos en tiempo real
                    </p>
                </div>

                <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl backdrop-blur-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-center text-2xl text-white">
                            ¡Bienvenido!
                        </CardTitle>
                        <CardDescription className="text-center text-slate-400">
                            {mode === 'login'
                                ? 'Ingresa tus credenciales para acceder a tus diagramas'
                                : 'Crea tu cuenta para guardar tus diagramas en la nube'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs
                            defaultValue={mode}
                            onValueChange={(val) => {
                                setMode(val as any);
                                setError('');
                            }}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 rounded-lg border border-slate-800 bg-slate-950 p-1">
                                <TabsTrigger
                                    value="login"
                                    className="text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white"
                                >
                                    Iniciar Sesión
                                </TabsTrigger>
                                <TabsTrigger
                                    value="register"
                                    className="text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white"
                                >
                                    Registrarse
                                </TabsTrigger>
                            </TabsList>

                            <form
                                onSubmit={handleSubmit}
                                className="mt-6 space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="email"
                                        className="text-slate-300"
                                    >
                                        Correo Electrónico
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="correo@ejemplo.com"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            required
                                            className="border-slate-800 bg-slate-950 pl-10 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="password"
                                        className="text-slate-300"
                                    >
                                        Contraseña
                                        {mode === 'register' && (
                                            <span className="ml-2 text-xs text-slate-500">
                                                (mínimo 6 caracteres)
                                            </span>
                                        )}
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            required
                                            minLength={6}
                                            className="border-slate-800 bg-slate-950 pl-10 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                                        {error}
                                    </div>
                                )}

                                {mode === 'register' && !error && (
                                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-slate-400">
                                        📧 Después de registrarte, recibirás un
                                        correo de verificación para activar tu
                                        cuenta.
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white hover:from-blue-500 hover:to-emerald-500"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            Procesando...
                                        </span>
                                    ) : mode === 'login' ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <LogIn className="size-4" /> Iniciar
                                            Sesión
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <UserPlus className="size-4" />{' '}
                                            Crear Cuenta
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </Tabs>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2 text-center text-xs text-slate-500">
                        <span>
                            Los diagramas se guardarán cifrados en Supabase
                            Cloud.
                        </span>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => navigate('/')}
                                className="text-blue-500 hover:underline"
                            >
                                Usar almacenamiento local temporal (IndexedDB)
                            </button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};
