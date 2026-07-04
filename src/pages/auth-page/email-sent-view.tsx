import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/card/card';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/button/button';

interface EmailSentViewProps {
    email: string;
    onBackToLogin: () => void;
}

export const EmailSentView: React.FC<EmailSentViewProps> = ({
    email,
    onBackToLogin,
}) => {
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
                                    Hemos enviado un enlace de verificación a:
                                </p>
                                <div className="inline-block rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 shadow-inner">
                                    {email}
                                </div>
                                <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
                                    Haz clic en el enlace del correo para
                                    activar tu cuenta y poder iniciar sesión.
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
                                    onClick={onBackToLogin}
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
};
