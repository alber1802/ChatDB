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
        <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-background p-4 font-sans text-foreground selection:bg-destructive/30">
            <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-8 shadow-lg">
                <div className="flex flex-col items-center text-center">
                    <div className="mb-6 flex size-16 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                        <WifiOff className="size-8" />
                    </div>

                    <h1 className="mb-3 text-heading font-bold tracking-tight text-foreground">
                        Conexión no disponible
                    </h1>

                    <p className="mb-8 text-body leading-relaxed text-muted-foreground">
                        No se ha podido conectar con el servidor o ha ocurrido
                        un error inesperado al cargar la aplicación. Por favor,
                        verifica tu conexión a Internet o inténtalo de nuevo.
                    </p>

                    <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
                        <Button
                            onClick={handleReload}
                            className="flex cursor-pointer items-center justify-center gap-2 bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                        >
                            <RotateCcw className="size-4" />
                            <span>Reintentar</span>
                        </Button>
                        <Button
                            onClick={handleGoHome}
                            variant="secondary"
                            className="flex cursor-pointer items-center justify-center gap-2"
                        >
                            <Home className="size-4" />
                            <span>Ir al inicio</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
