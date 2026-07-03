export interface UserProfile {
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    role_id: string;
    created_at: string;
    updated_at: string;
    email?: string; // Client-side addition for UI convenience
}

export interface Role {
    id: string;
    name: string;
    description: string | null;
    level: number;
    created_at: string;
}

export interface Permission {
    id: string;
    name: string;
    description: string | null;
    group_name: string;
    created_at: string;
}

export interface AuditLog {
    id: string;
    user_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
    user_email?: string; // Populated client-side or via join
}

export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    USER: 'user',
} as const;

export const PERMISSIONS = {
    USERS_LIST: 'users.list',
    USERS_EDIT: 'users.edit',
    USERS_DELETE: 'users.delete',
    USERS_ASSIGN_ROLE: 'users.assign_role',
    DIAGRAMS_LIST_ALL: 'diagrams.list_all',
    DIAGRAMS_DELETE_ANY: 'diagrams.delete_any',
    AUDIT_VIEW: 'audit.view',
    ADMIN_ACCESS: 'admin.access',
    ADMIN_SETTINGS: 'admin.settings',
} as const;
