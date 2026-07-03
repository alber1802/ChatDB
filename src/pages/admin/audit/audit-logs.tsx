import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import { Card, CardContent, CardHeader } from '@/components/card/card';
import { Input } from '@/components/input/input';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';
import { Search, Eye, RefreshCw } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';

interface AdminUserProfile {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role_id: string;
    created_at: string;
    updated_at: string;
}

interface AuditLog {
    id: string;
    created_at: string;
    user_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    metadata: Record<string, unknown> | null;
    user_email?: string;
}

export const AuditLogs: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [, setUsers] = useState<AdminUserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Detailed dialog state
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const fetchLogsAndUsers = async () => {
        try {
            setLoading(true);

            // Fetch users for client-side email mapping
            const { data: usersData, error: usersError } =
                await supabase.rpc('get_admin_users');
            if (usersError) throw usersError;
            const usersList = (usersData || []) as AdminUserProfile[];
            setUsers(usersList);

            // Fetch audit logs
            const { data: logsData, error: logsError } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false });
            if (logsError) throw logsError;

            // Map user emails
            const mappedLogs = ((logsData as AuditLog[]) || []).map((log) => {
                const userObj = usersList.find((u) => u.id === log.user_id);
                return {
                    ...log,
                    user_email: userObj
                        ? userObj.email
                        : log.user_id
                          ? 'Usuario Desconocido'
                          : 'Sistema',
                } as AuditLog;
            });

            setLogs(mappedLogs);
            setFilteredLogs(mappedLogs);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogsAndUsers();
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            setFilteredLogs(logs);
        } else {
            const filtered = logs.filter(
                (l) =>
                    l.action.toLowerCase().includes(term) ||
                    (l.user_email &&
                        l.user_email.toLowerCase().includes(term)) ||
                    (l.resource_type &&
                        l.resource_type.toLowerCase().includes(term))
            );
            setFilteredLogs(filtered);
        }
    }, [searchTerm, logs]);

    const handleInspectClick = (log: AuditLog) => {
        setSelectedLog(log);
        setIsDetailOpen(true);
    };

    const getActionBadgeColor = (action: string) => {
        if (action.includes('delete') || action.includes('remove')) {
            return 'bg-red-500/10 text-red-500 border border-red-500/20';
        }
        if (
            action.includes('update') ||
            action.includes('edit') ||
            action.includes('role')
        ) {
            return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
        }
        if (action.includes('create') || action.includes('add')) {
            return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
        }
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Spinner size="large" className="text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-y-6 font-primary">
            {/* Header */}
            <div className="flex flex-col justify-between gap-y-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        Logs de Auditoría
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Historial de acciones de administración y eventos
                        críticos en el sistema.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchLogsAndUsers}
                    className="flex w-fit items-center gap-x-2"
                >
                    <RefreshCw className="size-4" />
                    Actualizar
                </Button>
            </div>

            {/* Logs Table */}
            <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por acción, usuario o recurso..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-background pl-9"
                            />
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Mostrando {filteredLogs.length} logs registrados
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">
                                        Usuario
                                    </TableHead>
                                    <TableHead>Acción</TableHead>
                                    <TableHead>Tipo Recurso</TableHead>
                                    <TableHead>ID Recurso</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="pr-6 text-right">
                                        Ver Detalles
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            No se han registrado eventos de
                                            auditoría
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell
                                                className="max-w-[200px] truncate pl-6 font-medium"
                                                title={log.user_email}
                                            >
                                                {log.user_email}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${getActionBadgeColor(log.action)}`}
                                                >
                                                    {log.action}
                                                </span>
                                            </TableCell>
                                            <TableCell className="capitalize text-muted-foreground">
                                                {log.resource_type || '-'}
                                            </TableCell>
                                            <TableCell
                                                className="max-w-[120px] truncate font-mono text-xs text-muted-foreground"
                                                title={log.resource_id || ''}
                                            >
                                                {log.resource_id || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(
                                                    log.created_at
                                                ).toLocaleDateString()}{' '}
                                                {new Date(
                                                    log.created_at
                                                ).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        handleInspectClick(log)
                                                    }
                                                    title="Inspeccionar Log"
                                                    className="hover:bg-muted"
                                                >
                                                    <Eye className="size-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Log Details Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent
                    showClose
                    blurBackground
                    className="max-w-xl font-primary"
                >
                    <DialogHeader>
                        <DialogTitle>Detalle del Log de Auditoría</DialogTitle>
                        <DialogDescription>
                            Información detallada del evento registrado.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-4 text-sm">
                                <div>
                                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                        ID Evento
                                    </span>
                                    <span className="break-all font-mono text-xs text-muted-foreground">
                                        {selectedLog.id}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                        Fecha
                                    </span>
                                    <span>
                                        {new Date(
                                            selectedLog.created_at
                                        ).toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                        Usuario
                                    </span>
                                    <span>{selectedLog.user_email}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                        Acción
                                    </span>
                                    <span
                                        className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${getActionBadgeColor(selectedLog.action)}`}
                                    >
                                        {selectedLog.action}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                        Tipo Recurso
                                    </span>
                                    <span className="capitalize">
                                        {selectedLog.resource_type || '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                        ID Recurso
                                    </span>
                                    <span className="break-all font-mono text-xs">
                                        {selectedLog.resource_id || '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="block text-xs font-semibold uppercase text-muted-foreground">
                                    Metadatos (JSON)
                                </span>
                                <pre className="max-h-60 overflow-y-auto rounded border border-border bg-card p-3 font-mono text-xs text-foreground">
                                    {JSON.stringify(
                                        selectedLog.metadata,
                                        null,
                                        2
                                    )}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AuditLogs;
