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
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { translateAuthError } from './utils';

interface AuthCardProps {
    initialEmail?: string;
    onLoginSuccess: () => void;
    onRegisterSuccess: (email: string) => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({
    initialEmail = '',
    onLoginSuccess,
    onRegisterSuccess,
}) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
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
                    onLoginSuccess();
                }
            } else {
                const { error: authError } = await signUp(email, password);
                if (authError) {
                    setError(translateAuthError(authError.message));
                } else {
                    onRegisterSuccess(email);
                }
            }
        } catch (err: any) {
            setError(err?.message || 'Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
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
                                                    setEmail(e.target.value)
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
                                                    (mínimo 6 caracteres)
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
                                                    setPassword(e.target.value)
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
                            Los diagramas se guardarán cifrados en Supabase
                            Cloud.
                        </span>
                        <div className="flex justify-center gap-4">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="font-medium text-blue-400 transition-colors hover:text-blue-300 hover:underline"
                            >
                                Usar almacenamiento local temporal (IndexedDB)
                            </button>
                        </div>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
};
