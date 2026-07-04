import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/button/button';
import { RoleBadge } from '../_components/role-badge';
import { formatDateTime } from '../_utils/format-date';
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
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 text-xs font-semibold">
                            Usuario
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Nombre
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Rol
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Verificado
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                            Última Conexión
                        </TableHead>
                        <TableHead className="pr-6 text-right text-xs font-semibold">
                            Acciones
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i} className="hover:bg-transparent">
                                <TableCell className="py-4 pl-6">
                                    <Skeleton className="h-4 w-40 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-4 w-28 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-5 w-16 rounded-full bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-4 w-12 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <Skeleton className="h-4 w-32 bg-muted" />
                                </TableCell>
                                <TableCell className="py-4 pr-6">
                                    <div className="flex justify-end gap-x-2">
                                        <Skeleton className="size-8 rounded bg-muted" />
                                        <Skeleton className="size-8 rounded bg-muted" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="py-12 text-center text-sm text-muted-foreground"
                            >
                                No se encontraron usuarios
                            </TableCell>
                        </TableRow>
                    ) : (
                        users.map((user) => (
                            <TableRow
                                key={user.id}
                                className="transition-colors hover:bg-muted/30"
                            >
                                <TableCell
                                    className="max-w-[200px] truncate pl-6 text-sm font-medium text-foreground"
                                    title={user.email}
                                >
                                    {user.email}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate text-sm text-foreground">
                                    {user.display_name || '-'}
                                </TableCell>
                                <TableCell>
                                    <RoleBadge roleId={user.role_id} />
                                </TableCell>
                                <TableCell>
                                    {user.email_confirmed_at ? (
                                        <div className="flex items-center gap-x-1.5 text-xs font-medium text-emerald-500">
                                            <CheckCircle className="size-4 shrink-0" />
                                            <span>Sí</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-x-1.5 text-xs font-medium text-amber-500">
                                            <XCircle className="size-4 shrink-0" />
                                            <span>No</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatDateTime(user.last_sign_in_at)}
                                </TableCell>
                                <TableCell className="pr-6 text-right">
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
                                                disabled={
                                                    user.role_id ===
                                                    'super_admin'
                                                }
                                            >
                                                <Trash2 className="size-4 transition-colors" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
