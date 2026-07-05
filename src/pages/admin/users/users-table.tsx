import React from 'react';
import { Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/button/button';
import { RoleBadge } from '../_components/role-badge';
import { formatDateTime } from '../_utils/format-date';
import { AdminTable, type AdminColumn } from '../_components/admin-table';
import type { AdminUserProfile } from '../_types/admin.types';

interface UsersTableProps {
    users: AdminUserProfile[];
    loading: boolean;
    currentUserRole: string | null;
    onEdit: (user: AdminUserProfile) => void;
    onDelete: (user: AdminUserProfile) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
    users,
    loading,
    currentUserRole,
    onEdit,
    onDelete,
}) => {
    const columns: AdminColumn<AdminUserProfile>[] = [
        {
            header: 'Usuario',
            className: 'pl-6 text-xs font-semibold',
            cellClassName:
                'max-w-[200px] truncate pl-6 text-sm font-medium text-foreground',
            render: (user) => <span title={user.email}>{user.email}</span>,
        },
        {
            header: 'Nombre',
            className: 'text-xs font-semibold',
            cellClassName: 'max-w-[150px] truncate text-sm text-foreground',
            render: (user) => (
                <span title={user.display_name || ''}>
                    {user.display_name || '-'}
                </span>
            ),
        },
        {
            header: 'Rol',
            className: 'text-xs font-semibold',
            render: (user) => <RoleBadge roleId={user.role_id} />,
        },
        {
            header: 'Verificado',
            className: 'text-xs font-semibold',
            render: (user) =>
                user.email_confirmed_at ? (
                    <div className="flex items-center gap-x-1.5 text-xs font-medium text-emerald-500">
                        <CheckCircle className="size-4 shrink-0" />
                        <span>Sí</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-x-1.5 text-xs font-medium text-amber-500">
                        <XCircle className="size-4 shrink-0" />
                        <span>No</span>
                    </div>
                ),
        },
        {
            header: 'Última Conexión',
            className: 'text-xs font-semibold',
            cellClassName: 'text-xs text-muted-foreground',
            render: (user) => formatDateTime(user.last_sign_in_at),
        },
        {
            header: 'Acciones',
            className: 'pr-6 text-right text-xs font-semibold',
            cellClassName: 'pr-6 text-right',
            render: (user) => (
                <div className="flex justify-end gap-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(user)}
                        title="Editar Usuario"
                        className="size-8 cursor-pointer rounded-md hover:bg-muted"
                    >
                        <Edit2 className="size-4 text-muted-foreground transition-colors hover:text-foreground" />
                    </Button>
                    {currentUserRole === 'super_admin' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(user)}
                            title="Eliminar Datos de Usuario"
                            className="size-8 cursor-pointer rounded-md text-destructive hover:bg-destructive/15 disabled:opacity-40 disabled:hover:bg-transparent"
                            disabled={user.role_id === 'super_admin'}
                        >
                            <Trash2 className="size-4 transition-colors" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <AdminTable
            columns={columns}
            data={users}
            loading={loading}
            emptyMessage="No se encontraron usuarios"
        />
    );
};
