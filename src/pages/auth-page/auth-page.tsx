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
import { KeyRound, Mail, Lock, LogIn, UserPlus } from 'lucide-react';

export const AuthPage: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: authError } =
                mode === 'login'
                    ? await signIn(email, password)
                    : await signUp(email, password);

            if (authError) {
                setError(authError.message);
            } else {
                if (mode === 'register') {
                    // Si se registra, inicia sesión inmediatamente
                    const { error: loginError } = await signIn(email, password);
                    if (loginError) {
                        setError(loginError.message);
                    } else {
                        navigate('/');
                    }
                } else {
                    navigate('/');
                }
            }
        } catch (err: any) {
            setError(err?.message || 'Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

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
                            Ingresa tus credenciales para acceder a tus
                            diagramas
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs
                            defaultValue={mode}
                            onValueChange={(val) => setMode(val as any)}
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
                                            className="border-slate-800 bg-slate-950 pl-10 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                                        {error}
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
                                            Registrarse
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
