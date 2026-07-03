import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { Label } from '@/components/label/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import { Input } from '@/components/input/input';
import { useAuth } from '@/context/auth-context/auth-context';

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

interface UserEditDialogProps {
    user: AdminUserProfile | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const UserEditDialog: React.FC<UserEditDialogProps> = ({
    user,
    open,
    onOpenChange,
    onSuccess,
}) => {
    const { role: currentUserRole } = useAuth();
    const [roleId, setRoleId] = useState<string>('user');
    const [displayName, setDisplayName] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setRoleId(user.role_id || 'user');
            setDisplayName(user.display_name || '');
            setError(null);
        }
    }, [user, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);
        setError(null);

        try {
            // Update display name in user_profiles
            const { error: profileError } = await supabase
                .from('user_profiles')
                .update({ display_name: displayName })
                .eq('user_id', user.id);

            if (profileError) throw profileError;

            // Only update role if it has changed AND current user is super_admin
            if (user.role_id !== roleId) {
                if (currentUserRole !== 'super_admin') {
                    throw new Error(
                        'Solo los Super Administradores pueden cambiar roles.'
                    );
                }
                const { error: roleError } = await supabase.rpc(
                    'assign_user_role',
                    {
                        target_user_id: user.id,
                        target_role_id: roleId,
                    }
                );
                if (roleError) throw roleError;
            }

            onSuccess();
            onOpenChange(false);
        } catch (err: unknown) {
            console.error('Error updating user:', err);
            const errMsg =
                err instanceof Error
                    ? err.message
                    : 'Ocurrió un error inesperado al actualizar el usuario.';
            setError(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showClose blurBackground className="font-primary">
                <DialogHeader>
                    <DialogTitle>Editar Usuario</DialogTitle>
                    <DialogDescription>
                        Modifica los detalles del usuario y asigna roles en el
                        sistema.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {error && (
                        <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>Email</Label>
                        <Input
                            value={user?.email || ''}
                            disabled
                            className="bg-muted text-muted-foreground"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="display-name">Nombre de Pantalla</Label>
                        <Input
                            id="display-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Nombre del usuario"
                            maxLength={50}
                        />
                    </div>

                    {currentUserRole === 'super_admin' ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="role">Rol del Sistema</Label>
                            <Select value={roleId} onValueChange={setRoleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">
                                        Usuario Estándar
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        Administrador
                                    </SelectItem>
                                    <SelectItem value="super_admin">
                                        Super Administrador
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Label>Rol del Sistema</Label>
                            <Input
                                value={
                                    user?.role_id === 'super_admin'
                                        ? 'Super Admin'
                                        : user?.role_id === 'admin'
                                          ? 'Admin'
                                          : 'Usuario'
                                }
                                disabled
                                className="bg-muted text-muted-foreground"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Solo los Super Administradores pueden cambiar
                                roles.
                            </p>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
