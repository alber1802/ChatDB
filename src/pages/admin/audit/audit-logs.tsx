import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/card/card';
import { Input } from '@/components/input/input';
import { Button } from '@/components/button/button';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Search, RefreshCw } from 'lucide-react';
import { AuditDetailDialog } from './audit-detail-dialog';
import { AuditTable } from './audit-table';
import type { AuditLog, AdminUserProfile } from '../_types/admin.types';

export const AuditLogs: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
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

    return (
        <div className="flex select-none flex-col gap-y-6 font-primary">
            {/* Header */}
            <div className="flex flex-col justify-between gap-y-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Logs de Auditoría
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Historial de acciones de administración y eventos
                        críticos en el sistema.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchLogsAndUsers}
                    className="flex w-fit cursor-pointer items-center gap-x-2"
                >
                    <RefreshCw className="size-4" />
                    <span>Actualizar</span>
                </Button>
            </div>

            {/* Logs Table */}
            <Card className="border border-border/30 bg-card/45 shadow-sm backdrop-blur-md">
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
                            {loading ? (
                                <Skeleton className="h-4 w-32 bg-muted" />
                            ) : (
                                `Mostrando ${filteredLogs.length} logs registrados`
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <AuditTable
                        logs={filteredLogs}
                        loading={loading}
                        onInspect={handleInspectClick}
                    />
                </CardContent>
            </Card>

            {/* Log Details Modal */}
            <AuditDetailDialog
                log={selectedLog}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
            />
        </div>
    );
};

export default AuditLogs;
