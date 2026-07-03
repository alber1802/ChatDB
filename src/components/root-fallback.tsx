import React from 'react';
import { Spinner } from './spinner/spinner';

export const RootFallback = () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <Spinner size="large">
            <span className="mt-4 text-sm font-medium text-slate-400">
                Cargando ChartDB...
            </span>
        </Spinner>
    </div>
);
