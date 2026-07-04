import React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: number | string;
    description: string;
    icon: LucideIcon;
    iconColor: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    description,
    icon: Icon,
    iconColor,
}) => {
    return (
        <Card className="border border-border/40 shadow-sm transition-all duration-200 hover:border-border/80 hover:shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <Icon className={`size-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
};
