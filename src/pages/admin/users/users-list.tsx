import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/card/card';
import { Input } from '@/components/input/input';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Search } from 'lucide-react';
import { useAuth } from '@/context/auth-context/auth-context';
import { UserEditDialog } from './user-edit-dialog';
import { UsersTable } from './users-table';
import { useAlert } from '@/context/alert-context/alert-context';
import { useAdminUsers } from '../_hooks/use-admin-users';
import type { AdminUserProfile } from '../_types/admin.types';

export const UsersList: React.FC = () => {
    const { role: currentUserRole } = useAuth();
    const { showAlert } = useAlert();
    const { users, loading, refetch } = useAdminUsers();
    const [filteredUsers, setFilteredUsers] = useState<AdminUserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(
        null
    );
    const [isEditOpen, setIsEditOpen] = useState(false);

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
                    refetch();
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

    return (
        <div className="flex select-none flex-col gap-y-6 font-primary">
            {/* Header */}
            <div className="flex flex-col justify-between gap-y-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Gestión de Usuarios
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Administra perfiles de usuario, edita roles y gestiona
                        accesos.
                    </p>
                </div>
            </div>

            {/* Main Users Table */}
            <Card className="border border-border/30 bg-card/45 shadow-sm backdrop-blur-md">
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
                            {loading ? (
                                <Skeleton className="h-4 w-32 bg-muted" />
                            ) : (
                                `Mostrando ${filteredUsers.length} de ${users.length} usuarios`
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <UsersTable
                        users={filteredUsers}
                        loading={loading}
                        currentUserRole={currentUserRole}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                    />
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <UserEditDialog
                user={selectedUser}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={refetch}
            />
        </div>
    );
};

export default UsersList;
