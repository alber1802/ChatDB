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
import { Input } from '@/components/input/input';
import { useAuth } from '@/context/auth-context/auth-context';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/tabs/tabs';
import {
    User,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';

interface ProfileSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({
    open,
    onOpenChange,
}) => {
    const { user, profile, refreshProfile } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [submittingProfile, setSubmittingProfile] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Password fields
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submittingPassword, setSubmittingPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDisplayName(profile?.display_name || '');
            setProfileSuccess(false);
            setProfileError(null);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordSuccess(false);
            setPasswordError(null);
        }
    }, [open, profile]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmittingProfile(true);
        setProfileError(null);
        setProfileSuccess(false);

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ display_name: displayName })
                .eq('user_id', user.id);

            if (error) throw error;

            await refreshProfile();
            setProfileSuccess(true);
        } catch (err: unknown) {
            console.error('Error al actualizar perfil:', err);
            setProfileError(
                err instanceof Error
                    ? err.message
                    : 'Error al actualizar el nombre de pantalla.'
            );
        } finally {
            setSubmittingProfile(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (newPassword.length < 6) {
            setPasswordError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Las contraseñas no coinciden.');
            return;
        }

        setSubmittingPassword(true);
        setPasswordError(null);
        setPasswordSuccess(false);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            setPasswordSuccess(true);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: unknown) {
            console.error('Error al actualizar contraseña:', err);
            setPasswordError(
                err instanceof Error
                    ? err.message
                    : 'Error al actualizar la contraseña.'
            );
        } finally {
            setSubmittingPassword(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showClose
                blurBackground
                className="max-w-md font-primary"
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight">
                        Configuración de Cuenta
                    </DialogTitle>
                    <DialogDescription>
                        Actualiza tu información personal y configuración de
                        seguridad.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="profile" className="mt-2 w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1">
                        <TabsTrigger
                            value="profile"
                            className="flex items-center gap-2"
                        >
                            <User className="size-4" />
                            Perfil
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="flex items-center gap-2"
                        >
                            <Lock className="size-4" />
                            Seguridad
                        </TabsTrigger>
                    </TabsList>

                    {/* Profile Tab */}
                    <TabsContent
                        value="profile"
                        className="space-y-4 pt-3 focus-visible:outline-none focus-visible:ring-0"
                    >
                        <form
                            onSubmit={handleUpdateProfile}
                            className="space-y-4"
                        >
                            {profileSuccess && (
                                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-4 flex-shrink-0" />
                                    <span>¡Perfil actualizado con éxito!</span>
                                </div>
                            )}

                            {profileError && (
                                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                                    <AlertCircle className="size-4 flex-shrink-0" />
                                    <span>{profileError}</span>
                                </div>
                            )}

                            <div className="space-y-1">
                                <Label>Dirección de Email</Label>
                                <Input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="cursor-not-allowed bg-muted/50 text-muted-foreground"
                                />
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    El email no puede ser modificado.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="displayName">
                                    Nombre de Pantalla
                                </Label>
                                <Input
                                    id="displayName"
                                    type="text"
                                    placeholder="Ingresa tu nombre para mostrar"
                                    value={displayName}
                                    onChange={(e) =>
                                        setDisplayName(e.target.value)
                                    }
                                    required
                                    maxLength={50}
                                />
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    disabled={submittingProfile}
                                >
                                    Cerrar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={submittingProfile}
                                >
                                    {submittingProfile
                                        ? 'Guardando...'
                                        : 'Guardar Cambios'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    {/* Security Tab */}
                    <TabsContent
                        value="security"
                        className="space-y-4 pt-3 focus-visible:outline-none focus-visible:ring-0"
                    >
                        <form
                            onSubmit={handleUpdatePassword}
                            className="space-y-4"
                        >
                            {passwordSuccess && (
                                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-4 flex-shrink-0" />
                                    <span>
                                        ¡Contraseña actualizada con éxito!
                                    </span>
                                </div>
                            )}

                            {passwordError && (
                                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                                    <AlertCircle className="size-4 flex-shrink-0" />
                                    <span>{passwordError}</span>
                                </div>
                            )}

                            <div className="relative space-y-1">
                                <Label htmlFor="newPassword">
                                    Nueva Contraseña
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        placeholder="Mínimo 6 caracteres"
                                        value={newPassword}
                                        onChange={(e) =>
                                            setNewPassword(e.target.value)
                                        }
                                        required
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="size-4" />
                                        ) : (
                                            <Eye className="size-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="confirmPassword">
                                    Confirmar Nueva Contraseña
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Repite la nueva contraseña"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    required
                                    className="pr-10"
                                />
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    disabled={submittingPassword}
                                >
                                    Cerrar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={submittingPassword}
                                >
                                    {submittingPassword
                                        ? 'Actualizando...'
                                        : 'Actualizar Contraseña'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
