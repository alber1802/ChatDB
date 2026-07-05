import React from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/button/button';
import { Badge } from '@/components/badge/badge';
import { getActionBadgeInfo } from '../_utils/role-utils';
import { formatDateTime } from '../_utils/format-date';
import { AdminTable, type AdminColumn } from '../_components/admin-table';
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
    const columns: AdminColumn<AuditLog>[] = [
        {
            header: 'Usuario',
            className: 'pl-6 text-xs font-semibold',
            cellClassName:
                'max-w-[200px] truncate pl-6 text-sm font-medium text-foreground',
            render: (log) => (
                <span title={log.user_email}>{log.user_email}</span>
            ),
        },
        {
            header: 'Acción',
            className: 'text-xs font-semibold',
            render: (log) => {
                const { className: badgeClass } = getActionBadgeInfo(
                    log.action
                );
                return (
                    <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}
                    >
                        {log.action}
                    </Badge>
                );
            },
        },
        {
            header: 'Tipo Recurso',
            className: 'text-xs font-semibold',
            cellClassName: 'text-sm capitalize text-muted-foreground',
            render: (log) => log.resource_type || '-',
        },
        {
            header: 'ID Recurso',
            className: 'text-xs font-semibold',
            cellClassName:
                'max-w-[120px] truncate font-mono text-xs text-muted-foreground',
            render: (log) => (
                <span title={log.resource_id || ''}>
                    {log.resource_id || '-'}
                </span>
            ),
        },
        {
            header: 'Fecha',
            className: 'text-xs font-semibold',
            cellClassName: 'text-xs text-muted-foreground',
            render: (log) => formatDateTime(log.created_at),
        },
        {
            header: 'Detalles',
            className: 'pr-6 text-right text-xs font-semibold',
            cellClassName: 'pr-6 text-right',
            render: (log) => (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onInspect(log)}
                    title="Inspeccionar Log"
                    className="size-8 cursor-pointer rounded-md hover:bg-muted"
                >
                    <Eye className="size-4 text-muted-foreground transition-colors hover:text-foreground" />
                </Button>
            ),
        },
    ];

    return (
        <AdminTable
            columns={columns}
            data={logs}
            loading={loading}
            emptyMessage="No se han registrado eventos de auditoría"
        />
    );
};
