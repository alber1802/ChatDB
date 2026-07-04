import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Badge } from '@/components/badge/badge';
import { getActionBadgeInfo } from '../_utils/role-utils';
import { formatDateTime } from '../_utils/format-date';
import type { AuditLog } from '../_types/admin.types';

interface AuditDetailDialogProps {
    log: AuditLog | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AuditDetailDialog: React.FC<AuditDetailDialogProps> = ({
    log,
    open,
    onOpenChange,
}) => {
    if (!log) return null;

    const { className: badgeClass } = getActionBadgeInfo(log.action);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showClose
                blurBackground
                className="max-w-xl select-none font-primary"
            >
                <DialogHeader>
                    <DialogTitle>Detalle del Log de Auditoría</DialogTitle>
                    <DialogDescription>
                        Información detallada del evento registrado.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-4 text-sm">
                        <div>
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                ID Evento
                            </span>
                            <span className="break-all font-mono text-xs text-muted-foreground">
                                {log.id}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                Fecha
                            </span>
                            <span className="text-foreground">
                                {formatDateTime(log.created_at)}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                Usuario
                            </span>
                            <span
                                className="block truncate text-foreground"
                                title={log.user_email}
                            >
                                {log.user_email}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                Acción
                            </span>
                            <Badge
                                variant="outline"
                                className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}
                            >
                                {log.action}
                            </Badge>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                Tipo Recurso
                            </span>
                            <span className="capitalize text-foreground">
                                {log.resource_type || '-'}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                ID Recurso
                            </span>
                            <span className="break-all font-mono text-xs text-foreground">
                                {log.resource_id || '-'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="block text-xs font-semibold uppercase text-muted-foreground">
                            Metadatos (JSON)
                        </span>
                        <pre className="max-h-60 select-text overflow-y-auto rounded border border-border bg-slate-950 p-3 font-mono text-xs text-emerald-400">
                            {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
