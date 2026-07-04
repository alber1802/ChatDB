import React from 'react';
import { Users, FileText, Database, Activity } from 'lucide-react';
import { StatCard } from '../_components/stat-card';
import { Skeleton } from '@/components/skeleton/skeleton';
import type { DashboardStats } from '../_types/admin.types';

interface StatsGridProps {
    stats: DashboardStats;
    loading: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, loading }) => {
    if (loading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="space-y-3 rounded-xl border border-border/40 bg-card p-6 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-28 bg-muted" />
                            <Skeleton className="size-5 rounded bg-muted" />
                        </div>
                        <Skeleton className="h-8 w-16 bg-muted" />
                        <Skeleton className="h-3 w-40 bg-muted" />
                    </div>
                ))}
            </div>
        );
    }

    const statCards = [
        {
            title: 'Usuarios Totales',
            value: stats.totalUsers,
            description: `${stats.confirmedUsers} confirmados por email`,
            icon: Users,
            color: 'text-blue-500',
        },
        {
            title: 'Diagramas Guardados',
            value: stats.totalDiagrams,
            description: 'Distribuidos en todo el sistema',
            icon: FileText,
            color: 'text-purple-500',
        },
        {
            title: 'Tablas de BD',
            value: stats.totalTables,
            description: 'Tablas declaradas en los diagramas',
            icon: Database,
            color: 'text-emerald-500',
        },
        {
            title: 'Logs de Auditoría',
            value: stats.totalAuditLogs,
            description: 'Acciones de administración registradas',
            icon: Activity,
            color: 'text-amber-500',
        },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card, i) => (
                <StatCard
                    key={i}
                    title={card.title}
                    value={card.value}
                    description={card.description}
                    icon={card.icon}
                    iconColor={card.color}
                />
            ))}
        </div>
    );
};
