import React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import { Skeleton } from '@/components/skeleton/skeleton';
import { formatRelativeTime } from '../_utils/format-date';
import type { RecentDiagram } from '../_types/admin.types';

interface RecentDiagramsCardProps {
    diagrams: RecentDiagram[];
    loading: boolean;
}

export const RecentDiagramsCard: React.FC<RecentDiagramsCardProps> = ({
    diagrams,
    loading,
}) => {
    return (
        <Card className="flex h-full flex-col border border-border/30 bg-card/45 shadow-sm backdrop-blur-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                    Diagramas Recientes
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Los 5 diagramas modificados más recientemente en el sistema.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-6 text-xs font-semibold">
                                    Diagrama
                                </TableHead>
                                <TableHead className="text-xs font-semibold">
                                    Propietario
                                </TableHead>
                                <TableHead className="text-xs font-semibold">
                                    Modificado
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow
                                        key={i}
                                        className="hover:bg-transparent"
                                    >
                                        <TableCell className="py-3.5 pl-6">
                                            <Skeleton className="h-4 w-32 bg-muted" />
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <Skeleton className="h-4 w-28 bg-muted" />
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <Skeleton className="h-4 w-20 bg-muted" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : diagrams.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="py-8 text-center text-xs text-muted-foreground"
                                    >
                                        No hay diagramas creados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                diagrams.map((diag) => (
                                    <TableRow
                                        key={diag.id}
                                        className="transition-colors hover:bg-muted/30"
                                    >
                                        <TableCell
                                            className="max-w-[150px] truncate py-3 pl-6 text-sm font-medium text-foreground"
                                            title={diag.name}
                                        >
                                            {diag.name || 'Sin Título'}
                                        </TableCell>
                                        <TableCell
                                            className="max-w-[150px] truncate py-3 text-xs text-muted-foreground"
                                            title={diag.user_email}
                                        >
                                            {diag.user_email}
                                        </TableCell>
                                        <TableCell className="py-3 text-xs text-muted-foreground">
                                            {formatRelativeTime(
                                                diag.updated_at
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
