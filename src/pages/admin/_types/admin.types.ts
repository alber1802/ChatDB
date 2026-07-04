export interface AdminUserProfile {
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

export interface DashboardStats {
    totalUsers: number;
    confirmedUsers: number;
    totalDiagrams: number;
    totalTables: number;
    totalAuditLogs: number;
}

export interface RecentDiagram {
    id: string;
    name: string;
    updated_at: string;
    user_id: string;
    user_email?: string;
}

export interface AuditLog {
    id: string;
    created_at: string;
    user_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    metadata: Record<string, unknown> | null;
    user_email?: string;
}
