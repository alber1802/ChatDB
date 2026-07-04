import React from 'react';
import { Button } from '@/components/button/button';
import { Plus, Database, Sparkles } from 'lucide-react';

interface EmptyDashboardProps {
    onCreateNew: () => void;
}

export const EmptyDashboard: React.FC<EmptyDashboardProps> = ({ onCreateNew }) => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 py-16 rounded-xl border border-dashed border-border/60 bg-muted/10 max-w-2xl mx-auto my-8">
            <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl border border-border/40 bg-card shadow-sm text-primary">
                <Database className="size-8" />
                <div className="absolute -right-1 -top-1 rounded-full bg-primary/10 p-1 text-primary">
                    <Sparkles className="size-3.5 animate-pulse" />
                </div>
            </div>

            <h3 className="text-xl font-bold tracking-tight text-foreground">
                No tienes diagramas todavía
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Comienza a diseñar tu arquitectura de base de datos creando tu primer diagrama de base de datos interactivo. Puedes importar desde SQL existente o diseñar desde cero.
            </p>

            <Button
                onClick={onCreateNew}
                className="mt-6 gap-2 bg-primary px-5 font-semibold text-primary-foreground shadow transition-all duration-200 active:scale-95 hover:shadow-md"
            >
                <Plus className="size-4" />
                Crear tu primer diagrama
            </Button>
        </div>
    );
};
