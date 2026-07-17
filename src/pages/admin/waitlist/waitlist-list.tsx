import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/card/card';
import { Badge } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import { Skeleton } from '@/components/skeleton/skeleton';
import { AdminTable, type AdminColumn } from '../_components/admin-table';
import { formatDateTime } from '../_utils/format-date';
import type { WaitlistEntry } from '../_types/admin.types';
import { notify } from '@/lib/notifications';
import { useAuth } from '@/context/auth-context/auth-context';
import {
    Search,
    Clock,
    CheckCircle2,
    XCircle,
    Mail,
    UserCheck,
    ListFilter,
} from 'lucide-react';

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: WaitlistEntry['status'] }> = ({
    status,
}) => {
    const map = {
        pending: {
            label: 'Pendiente',
            className: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
            icon: Clock,
        },
        approved: {
            label: 'Aprobado',
            className:
                'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
            icon: CheckCircle2,
        },
        rejected: {
            label: 'Rechazado',
            className: 'border-red-500/30 bg-red-500/10 text-red-400',
            icon: XCircle,
        },
    } as const;

    const { label, className, icon: Icon } = map[status];

    return (
        <Badge
            variant="outline"
            className={`flex w-fit items-center gap-1 text-[11px] font-medium ${className}`}
        >
            <Icon className="size-3" />
            {label}
        </Badge>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const WaitlistList: React.FC = () => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [filtered, setFiltered] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<
        'all' | WaitlistEntry['status']
    >('all');
    const [approvingId, setApprovingId] = useState<string | null>(null);

    // ── Fetch waitlist entries ───────────────────────────────────────────
    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('waitlist')
                .select('*')
                .order('requested_at', { ascending: false });

            if (error) throw error;
            setEntries((data as WaitlistEntry[]) ?? []);
        } catch (err) {
            console.error(err);
            notify.error('Error', 'No se pudieron cargar las solicitudes.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    // ── Filter logic ─────────────────────────────────────────────────────
    useEffect(() => {
        let result = entries;

        if (statusFilter !== 'all') {
            result = result.filter((e) => e.status === statusFilter);
        }

        const term = searchTerm.toLowerCase().trim();
        if (term) {
            result = result.filter((e) => e.email.toLowerCase().includes(term));
        }

        setFiltered(result);
    }, [entries, searchTerm, statusFilter]);

    // ── Approve action ───────────────────────────────────────────────────
    const handleApprove = async (entry: WaitlistEntry) => {
        setApprovingId(entry.id);
        try {
            // 1. Invite user via Supabase Auth (sends email with magic link)
            const { error: inviteError } =
                await supabase.auth.admin.inviteUserByEmail(entry.email);

            if (inviteError) {
                // If user already exists, just mark as approved
                if (!inviteError.message.includes('already been registered')) {
                    throw inviteError;
                }
            }

            // 2. Update waitlist record
            const { error: updateError } = await supabase
                .from('waitlist')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    approved_by: user?.id ?? null,
                })
                .eq('id', entry.id);

            if (updateError) throw updateError;

            notify.success(
                'Acceso aprobado',
                `Se envió el correo de invitación a ${entry.email}`
            );
            fetchEntries();
        } catch (err) {
            console.error(err);
            const msg =
                err instanceof Error
                    ? err.message
                    : 'Error desconocido al aprobar';
            notify.error('Error al aprobar', msg);
        } finally {
            setApprovingId(null);
        }
    };

    // ── Reject action ────────────────────────────────────────────────────
    const handleReject = async (entry: WaitlistEntry) => {
        try {
            const { error } = await supabase
                .from('waitlist')
                .update({ status: 'rejected' })
                .eq('id', entry.id);

            if (error) throw error;
            notify.info('Solicitud rechazada', `${entry.email} fue rechazado.`);
            fetchEntries();
        } catch (err) {
            console.error(err);
            notify.error('Error', 'No se pudo rechazar la solicitud.');
        }
    };

    // ── Table columns ────────────────────────────────────────────────────
    const columns: AdminColumn<WaitlistEntry>[] = [
        {
            header: 'Correo',
            className: 'pl-6 text-xs font-semibold',
            cellClassName: 'max-w-[220px] truncate pl-6 text-sm font-medium',
            render: (e) => (
                <div className="flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    <span title={e.email}>{e.email}</span>
                </div>
            ),
        },
        {
            header: 'Estado',
            className: 'text-xs font-semibold',
            render: (e) => <StatusBadge status={e.status} />,
        },
        {
            header: 'Solicitado',
            className: 'text-xs font-semibold',
            cellClassName: 'text-xs text-muted-foreground',
            render: (e) => formatDateTime(e.requested_at),
        },
        {
            header: 'Aprobado',
            className: 'text-xs font-semibold',
            cellClassName: 'text-xs text-muted-foreground',
            render: (e) =>
                e.approved_at ? formatDateTime(e.approved_at) : '—',
        },
        {
            header: 'Acciones',
            className: 'pr-6 text-right text-xs font-semibold',
            cellClassName: 'pr-6 text-right',
            render: (e) => (
                <div className="flex justify-end gap-1.5">
                    {e.status === 'pending' && (
                        <>
                            <Button
                                size="sm"
                                disabled={approvingId === e.id}
                                onClick={() => handleApprove(e)}
                                className="h-7 gap-1.5 border-none bg-emerald-600 px-2.5 text-xs hover:bg-emerald-500 disabled:opacity-60"
                            >
                                <UserCheck className="size-3.5" />
                                {approvingId === e.id
                                    ? 'Enviando...'
                                    : 'Aprobar'}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReject(e)}
                                className="h-7 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <XCircle className="size-3.5" />
                                Rechazar
                            </Button>
                        </>
                    )}
                    {e.status === 'approved' && (
                        <span className="text-xs text-emerald-500">
                            ✓ Aprobado
                        </span>
                    )}
                    {e.status === 'rejected' && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApprove(e)}
                            disabled={approvingId === e.id}
                            className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Reconsiderar
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    // ── Counts ───────────────────────────────────────────────────────────
    const pendingCount = entries.filter((e) => e.status === 'pending').length;

    return (
        <div className="flex select-none flex-col gap-y-6 font-primary">
            {/* Header */}
            <div className="flex flex-col justify-between gap-y-4 sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                            Lista de Espera
                        </h2>
                        {pendingCount > 0 && (
                            <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                                {pendingCount}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Gestiona las solicitudes de acceso Beta y aprueba el
                        acceso de nuevos usuarios.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card className="border border-border/30 bg-card/45 shadow-sm backdrop-blur-md">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Search */}
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por correo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-background pl-9"
                            />
                        </div>

                        {/* Status filter tabs */}
                        <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-muted/30 p-1">
                            <ListFilter className="ml-1 size-3.5 text-muted-foreground" />
                            {(
                                [
                                    'all',
                                    'pending',
                                    'approved',
                                    'rejected',
                                ] as const
                            ).map((s) => {
                                const labels = {
                                    all: 'Todos',
                                    pending: 'Pendientes',
                                    approved: 'Aprobados',
                                    rejected: 'Rechazados',
                                };
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(s)}
                                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                                            statusFilter === s
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {labels[s]}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="text-xs text-muted-foreground">
                            {loading ? (
                                <Skeleton className="h-4 w-32 bg-muted" />
                            ) : (
                                `${filtered.length} de ${entries.length} solicitudes`
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <AdminTable
                        columns={columns}
                        data={filtered}
                        loading={loading}
                        emptyMessage="No hay solicitudes en esta categoría"
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default WaitlistList;
