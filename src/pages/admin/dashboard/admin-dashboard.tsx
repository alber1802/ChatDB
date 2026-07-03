import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Users, FileText, Database, Activity } from 'lucide-react';
import { Spinner } from '@/components/spinner/spinner';

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

interface DashboardStats {
    totalUsers: number;
    confirmedUsers: number;
    totalDiagrams: number;
    totalTables: number;
    totalAuditLogs: number;
}

interface RecentDiagram {
    id: string;
    name: string;
    updated_at: string;
    user_id: string;
    user_email?: string;
}

export const AdminDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        confirmedUsers: 0,
        totalDiagrams: 0,
        totalTables: 0,
        totalAuditLogs: 0,
    });
    const [recentUsers, setRecentUsers] = useState<AdminUserProfile[]>([]);
    const [recentDiagrams, setRecentDiagrams] = useState<RecentDiagram[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);

                // Fetch Users through our secure RPC
                const { data: usersData, error: usersError } =
                    await supabase.rpc('get_admin_users');
                if (usersError) throw usersError;

                const users = usersData as AdminUserProfile[] | null;

                const confirmedCount = users
                    ? users.filter((u) => u.email_confirmed_at !== null).length
                    : 0;

                // Fetch Diagrams count
                const { count: diagramsCount, error: dError } = await supabase
                    .from('diagrams')
                    .select('*', { count: 'exact', head: true });
                if (dError) throw dError;

                // Fetch Tables count
                const { count: tablesCount, error: tError } = await supabase
                    .from('db_tables')
                    .select('*', { count: 'exact', head: true });
                if (tError) throw tError;

                // Fetch Audit Logs count
                const { count: logsCount, error: lError } = await supabase
                    .from('audit_logs')
                    .select('*', { count: 'exact', head: true });
                if (lError) throw lError;

                setStats({
                    totalUsers: users ? users.length : 0,
                    confirmedUsers: confirmedCount,
                    totalDiagrams: diagramsCount || 0,
                    totalTables: tablesCount || 0,
                    totalAuditLogs: logsCount || 0,
                });

                // Set 5 most recent users
                if (users) {
                    setRecentUsers(users.slice(0, 5));
                }

                // Fetch 5 most recent diagrams, joining user info manually or with a join if schema allows
                // Since we have the users list, we can map user emails client-side!
                const { data: diagrams, error: diagError } = await supabase
                    .from('diagrams')
                    .select('id, name, updated_at, user_id')
                    .order('updated_at', { ascending: false })
                    .limit(5);

                if (diagError) throw diagError;

                if (diagrams && users) {
                    const mappedDiagrams = (diagrams as RecentDiagram[]).map(
                        (d) => {
                            const owner = users.find((u) => u.id === d.user_id);
                            return {
                                ...d,
                                user_email: owner
                                    ? owner.email
                                    : 'Usuario Desconocido',
                            };
                        }
                    );
                    setRecentDiagrams(mappedDiagrams);
                } else if (diagrams) {
                    setRecentDiagrams(diagrams as RecentDiagram[]);
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Spinner size="large" className="text-primary" />
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
            description: `Distribuidos en todo el sistema`,
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
        <div className="flex flex-col gap-y-6 font-primary">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    Dashboard General
                </h2>
                <p className="text-sm text-muted-foreground">
                    Vista general de la actividad y métricas clave de ChatDB.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <Card
                            key={i}
                            className="border border-border/40 shadow-sm"
                        >
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {card.title}
                                </CardTitle>
                                <Icon className={`size-4 ${card.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {card.value}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {card.description}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Recent Activity Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Recent Users Card */}
                <Card className="border border-border/40 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">
                            Usuarios Recientes
                        </CardTitle>
                        <CardDescription>
                            Los últimos 5 usuarios que se han registrado.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Rol</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={3}
                                                className="py-4 text-center text-muted-foreground"
                                            >
                                                No hay usuarios registrados
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        recentUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell
                                                    className="max-w-[180px] truncate font-medium"
                                                    title={user.email}
                                                >
                                                    {user.email}
                                                </TableCell>
                                                <TableCell className="max-w-[120px] truncate">
                                                    {user.display_name || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                                                            user.role_id ===
                                                            'super_admin'
                                                                ? 'bg-red-500/10 text-red-500'
                                                                : user.role_id ===
                                                                    'admin'
                                                                  ? 'bg-blue-500/10 text-blue-500'
                                                                  : 'bg-green-500/10 text-green-500'
                                                        }`}
                                                    >
                                                        {user.role_id ===
                                                        'super_admin'
                                                            ? 'Super Admin'
                                                            : user.role_id ===
                                                                'admin'
                                                              ? 'Admin'
                                                              : 'User'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Diagrams Card */}
                <Card className="border border-border/40 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">
                            Diagramas Recientes
                        </CardTitle>
                        <CardDescription>
                            Los 5 diagramas modificados más recientemente en el
                            sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Último Cambio</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentDiagrams.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={3}
                                                className="py-4 text-center text-muted-foreground"
                                            >
                                                No hay diagramas creados
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        recentDiagrams.map((diag) => (
                                            <TableRow key={diag.id}>
                                                <TableCell
                                                    className="max-w-[150px] truncate font-medium"
                                                    title={diag.name}
                                                >
                                                    {diag.name || 'Sin Título'}
                                                </TableCell>
                                                <TableCell
                                                    className="max-w-[150px] truncate"
                                                    title={diag.user_email}
                                                >
                                                    {diag.user_email}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {new Date(
                                                        diag.updated_at
                                                    ).toLocaleDateString()}{' '}
                                                    {new Date(
                                                        diag.updated_at
                                                    ).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboard;
