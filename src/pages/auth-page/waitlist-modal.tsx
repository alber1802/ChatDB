import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import { Label } from '@/components/label/label';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notifications';

interface WaitlistModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
    isOpen,
    onClose,
}) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.from('waitlist').insert({
                email: email.toLowerCase().trim(),
            });

            if (error) {
                if (error.code === '23505') {
                    // unique violation — email already in list
                    notify.info(
                        'Correo ya registrado',
                        'Este correo ya está en nuestra lista de espera. ¡Te avisaremos pronto!'
                    );
                    setSubmitted(true);
                } else {
                    throw error;
                }
            } else {
                notify.success(
                    '¡Solicitud enviada!',
                    'Recibirás un correo cuando tu acceso sea aprobado.'
                );
                setSubmitted(true);
            }
        } catch (err) {
            console.error(err);
            notify.error(
                'Error al enviar',
                'No pudimos registrar tu solicitud. Intenta de nuevo más tarde.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        // Reset after animation completes
        setTimeout(() => {
            setEmail('');
            setSubmitted(false);
        }, 300);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Modal */}
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{
                            type: 'spring',
                            damping: 25,
                            stiffness: 300,
                        }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
                    >
                        <div className="dark relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_0_60px_-12px_rgba(99,102,241,0.3)] backdrop-blur-xl">
                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                aria-label="Cerrar"
                            >
                                <X className="size-4" />
                            </button>

                            {/* Gradient accent */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                            <div className="p-6">
                                <AnimatePresence mode="wait">
                                    {submitted ? (
                                        /* ── Success state ── */
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="flex flex-col items-center gap-4 py-4 text-center"
                                        >
                                            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                                                <CheckCircle2 className="size-8 text-emerald-400" />
                                            </div>
                                            <div className="space-y-1">
                                                <h2 className="text-xl font-bold text-white">
                                                    ¡Solicitud registrada!
                                                </h2>
                                                <p className="text-sm text-slate-400">
                                                    Hemos recibido tu correo{' '}
                                                    <span className="font-medium text-slate-200">
                                                        {email}
                                                    </span>
                                                    . Recibirás un aviso en
                                                    cuanto el equipo apruebe tu
                                                    acceso.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-2 text-xs text-slate-400">
                                                <Clock className="size-3.5 shrink-0 text-indigo-400" />
                                                El tiempo de espera suele ser de
                                                24–48 horas.
                                            </div>
                                            <Button
                                                onClick={handleClose}
                                                className="mt-2 border-none bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500"
                                            >
                                                Entendido
                                            </Button>
                                        </motion.div>
                                    ) : (
                                        /* ── Form state ── */
                                        <motion.div
                                            key="form"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-5"
                                        >
                                            {/* Header */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300">
                                                        Acceso Anticipado
                                                    </span>
                                                </div>
                                                <h2 className="text-xl font-bold text-white">
                                                    Solicita tu acceso Beta
                                                </h2>
                                                <p className="text-sm text-slate-400">
                                                    Estamos en acceso
                                                    controlado. Déjanos tu
                                                    correo y te avisaremos
                                                    cuando podamos darte acceso.
                                                </p>
                                            </div>

                                            {/* Features list */}
                                            <ul className="space-y-1.5 text-xs text-slate-400">
                                                {[
                                                    'Crea diagramas de bases de datos visualmente',
                                                    'Exporta a SQL (PostgreSQL, MySQL, SQLite…)',
                                                    'Colabora y comparte con tu equipo',
                                                ].map((feat) => (
                                                    <li
                                                        key={feat}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <span className="size-1.5 rounded-full bg-indigo-400" />
                                                        {feat}
                                                    </li>
                                                ))}
                                            </ul>

                                            {/* Form */}
                                            <form
                                                onSubmit={handleSubmit}
                                                className="space-y-3"
                                            >
                                                <div className="space-y-1.5">
                                                    <Label
                                                        htmlFor="waitlist-email"
                                                        className="text-xs font-semibold text-slate-300"
                                                    >
                                                        Correo electrónico
                                                    </Label>
                                                    <div className="group relative">
                                                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-400" />
                                                        <Input
                                                            id="waitlist-email"
                                                            type="email"
                                                            placeholder="tucorreo@empresa.com"
                                                            value={email}
                                                            onChange={(e) =>
                                                                setEmail(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            required
                                                            className="h-10 border-white/10 bg-slate-900/40 pl-10 text-white placeholder-slate-500 transition-all hover:bg-slate-900/60 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="h-10 w-full border-none bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 hover:shadow-indigo-500/35 active:scale-[0.98]"
                                                >
                                                    {loading ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                            <Loader2 className="size-4 animate-spin" />
                                                            Enviando...
                                                        </span>
                                                    ) : (
                                                        'Solicitar Acceso'
                                                    )}
                                                </Button>
                                            </form>

                                            <p className="text-center text-[11px] text-slate-500">
                                                No compartimos tu correo con
                                                terceros.
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
