import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Eye } from 'lucide-react';
import { Button } from '@/components/button/button';
import { Badge } from '@/components/badge/badge';
import { getActionBadgeInfo } from '../_utils/role-utils';
import { formatDateTime } from '../_utils/format-date';
import type { AuditLog } from '../_types/admin.types';

interface AuditTableProps {
    logs: AuditLog[];
    loading: boolean;
    onInspect: (log: AuditLog) => void;
}

export const AuditTable: React.FC<AuditTableProps> = ({
    logs,
    loading,
    onInspect,
}) => {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 text-xs font-semibold">
                            Usuario
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Acción
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Tipo Recurso
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            ID Recurso
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Fecha
                        </TableHead>
                        <TableHead className="pr-6 text-right text-xs font-semibold">
                            Detalles
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i} className="hover:bg-transparent">
                                <TableCell className="py-4 pl-6">
                                    <Skeleton className="h-4 w-40 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-5 w-24 rounded bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-4 w-20 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-4 w-24 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-4 w-32 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4 pr-6 text-right">
                                    <Skeleton className="ml-auto size-8 rounded bg-muted" />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : logs.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="py-12 text-center text-sm text-muted-foreground"
                            >
                                No se han registrado eventos de auditoría
                            </TableCell>
                        </TableRow>
                    ) : (
                        logs.map((log) => {
                            const { className: badgeClass } =
                                getActionBadgeInfo(log.action);
                            return (
                                <TableRow
                                    key={log.id}
                                    className="transition-colors hover:bg-muted/30"
                                >
                                    <TableCell
                                        className="max-w-[200px] truncate pl-6 text-sm font-medium text-foreground"
                                        title={log.user_email}
                                    >
                                        {log.user_email}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}
                                        >
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm capitalize text-muted-foreground">
                                        {log.resource_type || '-'}
                                    </TableCell>
                                    <TableCell
                                        className="max-w-[120px] truncate font-mono text-xs text-muted-foreground"
                                        title={log.resource_id || ''}
                                    >
                                        {log.resource_id || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {formatDateTime(log.created_at)}
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onInspect(log)}
                                            title="Inspeccionar Log"
                                            className="size-8 cursor-pointer rounded-md hover:bg-muted"
                                        >
                                            <Eye className="size-4 text-muted-foreground transition-colors hover:text-foreground" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
