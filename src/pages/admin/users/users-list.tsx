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
import { Edit2, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context/auth-context';
import { UserEditDialog } from './user-edit-dialog';
import { useAlert } from '@/context/alert-context/alert-context';

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

export const UsersList: React.FC = () => {
    const { role: currentUserRole } = useAuth();
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<AdminUserProfile[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<AdminUserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(
        null
    );
    const [isEditOpen, setIsEditOpen] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_admin_users');
            if (error) throw error;
            const usersList = (data || []) as AdminUserProfile[];
            setUsers(usersList);
            setFilteredUsers(usersList);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter(
                (u) =>
                    u.email.toLowerCase().includes(term) ||
                    (u.display_name &&
                        u.display_name.toLowerCase().includes(term))
            );
            setFilteredUsers(filtered);
        }
    }, [searchTerm, users]);

    const handleEditClick = (user: AdminUserProfile) => {
        setSelectedUser(user);
        setIsEditOpen(true);
    };

    const handleDeleteClick = (user: AdminUserProfile) => {
        if (currentUserRole !== 'super_admin') {
            showAlert({
                title: 'Acción No Permitida',
                description:
                    'Solo los Super Administradores pueden eliminar datos de usuario.',
                closeLabel: 'Entendido',
            });
            return;
        }

        if (user.role_id === 'super_admin') {
            showAlert({
                title: 'Acción No Permitida',
                description: 'No se puede eliminar a otro Super Administrador.',
                closeLabel: 'Entendido',
            });
            return;
        }

        showAlert({
            title: '¿Confirmar eliminación?',
            description: `Esta acción eliminará todos los diagramas y configuraciones de ${user.email}. Esta acción es irreversible.`,
            actionLabel: 'Eliminar Permanentemente',
            closeLabel: 'Cancelar',
            onAction: async () => {
                try {
                    const { error } = await supabase.rpc('delete_user_data', {
                        target_user_id: user.id,
                    });
                    if (error) throw error;
                    fetchUsers();
                } catch (err: unknown) {
                    console.error('Error deleting user:', err);
                    const errMsg =
                        err instanceof Error
                            ? err.message
                            : 'Ocurrió un error inesperado.';
                    showAlert({
                        title: 'Error al Eliminar',
                        description: errMsg,
                        closeLabel: 'Cerrar',
                    });
                }
            },
        });
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
                        Gestión de Usuarios
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Administra perfiles de usuario, edita roles y gestiona
                        accesos.
                    </p>
                </div>
            </div>

            {/* Main Users Table */}
            <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por email o nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-background pl-9"
                            />
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Mostrando {filteredUsers.length} de {users.length}{' '}
                            usuarios
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
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Verificado</TableHead>
                                    <TableHead>Última Conexión</TableHead>
                                    <TableHead className="pr-6 text-right">
                                        Acciones
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            No se encontraron usuarios
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell
                                                className="max-w-[200px] truncate pl-6 font-medium"
                                                title={user.email}
                                            >
                                                {user.email}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate">
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
                                            <TableCell>
                                                {user.email_confirmed_at ? (
                                                    <div className="flex items-center gap-x-1.5 text-xs text-emerald-500">
                                                        <CheckCircle className="size-4" />
                                                        <span>Sí</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-x-1.5 text-xs text-amber-500">
                                                        <XCircle className="size-4" />
                                                        <span>No</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.last_sign_in_at
                                                    ? new Date(
                                                          user.last_sign_in_at
                                                      ).toLocaleDateString() +
                                                      ' ' +
                                                      new Date(
                                                          user.last_sign_in_at
                                                      ).toLocaleTimeString([], {
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : 'Nunca'}
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <div className="flex justify-end gap-x-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            handleEditClick(
                                                                user
                                                            )
                                                        }
                                                        title="Editar Usuario"
                                                        className="hover:bg-muted"
                                                    >
                                                        <Edit2 className="size-4" />
                                                    </Button>
                                                    {currentUserRole ===
                                                        'super_admin' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                handleDeleteClick(
                                                                    user
                                                                )
                                                            }
                                                            title="Eliminar Datos de Usuario"
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            disabled={
                                                                user.role_id ===
                                                                'super_admin'
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
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
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <UserEditDialog
                user={selectedUser}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={fetchUsers}
            />
        </div>
    );
};

export default UsersList;
