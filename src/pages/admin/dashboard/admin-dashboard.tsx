import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { StatsGrid } from './stats-grid';
import { RecentUsersCard } from './recent-users-card';
import { RecentDiagramsCard } from './recent-diagrams-card';
import type {
    DashboardStats,
    AdminUserProfile,
    RecentDiagram,
} from '../_types/admin.types';

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

                // Fetch Users through secure RPC
                const { data: usersData, error: usersError } =
                    await supabase.rpc('get_admin_users');
                if (usersError) throw usersError;

                const users = (usersData || []) as AdminUserProfile[];
                const confirmedCount = users.filter(
                    (u) => u.email_confirmed_at !== null
                ).length;

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
                    totalUsers: users.length,
                    confirmedUsers: confirmedCount,
                    totalDiagrams: diagramsCount || 0,
                    totalTables: tablesCount || 0,
                    totalAuditLogs: logsCount || 0,
                });

                // Set 5 most recent users
                setRecentUsers(users.slice(0, 5));

                // Fetch 5 most recent diagrams
                const { data: diagrams, error: diagError } = await supabase
                    .from('diagrams')
                    .select('id, name, updated_at, user_id')
                    .order('updated_at', { ascending: false })
                    .limit(5);

                if (diagError) throw diagError;

                if (diagrams) {
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
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div className="flex select-none flex-col gap-y-6 font-primary">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Dashboard General
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Vista general de la actividad y métricas clave de ChartDB.
                </p>
            </div>

            {/* Stats Grid */}
            <StatsGrid stats={stats} loading={loading} />

            {/* Recent Activity Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                <RecentUsersCard users={recentUsers} loading={loading} />
                <RecentDiagramsCard
                    diagrams={recentDiagrams}
                    loading={loading}
                />
            </div>
        </div>
    );
};

export default AdminDashboard;
