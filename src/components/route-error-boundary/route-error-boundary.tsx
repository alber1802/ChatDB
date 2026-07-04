import React from 'react';
import { useRouteError } from 'react-router-dom';
import { WifiOff, RotateCcw, Home } from 'lucide-react';
import { Button } from '../button/button';

export const RouteErrorBoundary: React.FC = () => {
    const error = useRouteError();
    console.error('Unhandled Route Error:', error);

    const handleReload = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = '/';
    };

    return (
        <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-200 selection:bg-pink-500/30">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80">
                {/* Decorative top gradient */}
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

                <div className="flex flex-col items-center text-center">
                    {/* Icon Container with glowing effect */}
                    <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-slate-800/50 text-pink-500 shadow-inner">
                        <WifiOff className="size-8 animate-pulse text-pink-400" />
                        <div className="absolute inset-0 rounded-2xl bg-pink-500/10 blur-xl" />
                    </div>

                    <h1 className="mb-3 text-2xl font-bold tracking-tight text-white">
                        Conexión no disponible
                    </h1>

                    <p className="mb-8 text-sm leading-relaxed text-slate-400">
                        No se ha podido conectar con el servidor o ha ocurrido
                        un error inesperado al cargar la aplicación. Por favor,
                        verifica tu conexión a Internet o inténtalo de nuevo.
                    </p>

                    <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
                        <Button
                            onClick={handleReload}
                            className="flex cursor-pointer items-center justify-center gap-2 border-none bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/10 transition-all duration-200 hover:scale-[1.02] hover:from-pink-500 hover:to-purple-500 active:scale-[0.98]"
                        >
                            <RotateCcw className="size-4" />
                            <span>Reintentar</span>
                        </Button>
                        <Button
                            onClick={handleGoHome}
                            variant="secondary"
                            className="flex cursor-pointer items-center justify-center gap-2 border border-slate-700 bg-slate-800/40 text-slate-300 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800 hover:text-white active:scale-[0.98]"
                        >
                            <Home className="size-4" />
                            <span>Ir al inicio</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Subtle background glow blobs */}
            <div className="absolute left-1/4 top-1/4 -z-10 size-72 rounded-full bg-pink-600/5 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 -z-10 size-72 rounded-full bg-purple-600/5 blur-[120px]" />
        </div>
    );
};
