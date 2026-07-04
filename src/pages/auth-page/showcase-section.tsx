import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Database, Cloud } from 'lucide-react';

export const ShowcaseSection: React.FC = () => {
    return (
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
    );
};
