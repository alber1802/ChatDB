import React, { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Copy,
    LogOut,
    Mail,
    RotateCw,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/tabs/tabs';
import { Spinner } from '@/components/spinner/spinner';
import { useDialog } from '@/hooks/use-dialog';
import { useAuth } from '@/context/auth-context/auth-context';
import { notify } from '@/lib/notifications';
import { accessRoleLabel } from '@/lib/domain/diagram-access';
import {
    collaborationApi,
    type DiagramAccessInfo,
    type DiagramInvitation,
    type DiagramMember,
    type MemberRole,
    type ShareCandidate,
} from '@/lib/collaboration/collaboration-api';
import {
    invitationErrorMessage,
    isValidEmail,
} from '@/lib/collaboration/share-helpers';
import type { BaseDialogProps } from '../common/base-dialog-props';
import { PersonAvatar } from './person-avatar';
import { UserPicker } from './user-picker';

export interface ShareDiagramDialogProps extends BaseDialogProps {
    diagramId: string;
    diagramName: string;
    /** Se llama tras cambios que afectan a la lista de diagramas (abandonar). */
    onChanged?: () => void;
}

const RoleSelect: React.FC<{
    value: MemberRole;
    onChange: (role: MemberRole) => void;
    disabled?: boolean;
    label: string;
}> = ({ value, onChange, disabled, label }) => (
    <Select
        value={value}
        onValueChange={(v) => onChange(v as MemberRole)}
        disabled={disabled}
    >
        <SelectTrigger className="h-9 w-[108px] shrink-0" aria-label={label}>
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="editor">{accessRoleLabel('editor')}</SelectItem>
            <SelectItem value="viewer">{accessRoleLabel('viewer')}</SelectItem>
        </SelectContent>
    </Select>
);

const daysLeft = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export const ShareDiagramDialog: React.FC<ShareDiagramDialogProps> = ({
    dialog,
    diagramId,
    diagramName,
    onChanged,
}) => {
    const { closeShareDiagramDialog } = useDialog();
    const { user } = useAuth();
    const navigate = useNavigate();
    const ids = useId();

    const [loading, setLoading] = useState(false);
    const [access, setAccess] = useState<DiagramAccessInfo>();
    const [members, setMembers] = useState<DiagramMember[]>([]);
    const [invitations, setInvitations] = useState<DiagramInvitation[]>([]);
    const [busy, setBusy] = useState(false);

    // Vía 1: usuario del sistema
    const [pickedUser, setPickedUser] = useState<ShareCandidate>();
    const [userRole, setUserRole] = useState<MemberRole>('editor');
    // Vía 2: invitación por correo
    const [email, setEmail] = useState('');
    const [emailRole, setEmailRole] = useState<MemberRole>('editor');
    const [lastLink, setLastLink] = useState<string>();

    const isOwner = access?.accessRole === 'owner' || !access?.accessRole;

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const info = await collaborationApi.getDiagramAccess(diagramId);
            setAccess(info);
            const owner = info.accessRole === 'owner' || !info.accessRole;
            const [nextMembers, nextInvitations] = await Promise.all([
                collaborationApi.listMembers(diagramId),
                owner
                    ? collaborationApi
                          .listInvitations(diagramId)
                          .catch(() => [] as DiagramInvitation[])
                    : Promise.resolve([] as DiagramInvitation[]),
            ]);
            setMembers(nextMembers);
            setInvitations(nextInvitations);
        } catch (err) {
            notify.error(
                'No se pudo cargar el acceso',
                invitationErrorMessage(err)
            );
        } finally {
            setLoading(false);
        }
    }, [diagramId]);

    useEffect(() => {
        if (!dialog.open) return;
        setPickedUser(undefined);
        setEmail('');
        setLastLink(undefined);
        void reload();
    }, [dialog.open, reload]);

    const handleShareWithUser = useCallback(async () => {
        if (!pickedUser) return;
        setBusy(true);
        try {
            await collaborationApi.shareWithUser(
                diagramId,
                pickedUser.userId,
                userRole
            );
            notify.success(
                'Diagrama compartido',
                `${pickedUser.displayName ?? pickedUser.email} recibirá una notificación.`
            );
            setPickedUser(undefined);
            await reload();
        } catch (err) {
            notify.error('No se pudo compartir', invitationErrorMessage(err));
        } finally {
            setBusy(false);
        }
    }, [diagramId, pickedUser, userRole, reload]);

    const normalizedEmail = email.trim().toLowerCase();
    const emailValid = isValidEmail(normalizedEmail);

    const handleInviteByEmail = useCallback(async () => {
        if (!emailValid) return;
        setBusy(true);
        try {
            const result = await collaborationApi.invite(
                diagramId,
                normalizedEmail,
                emailRole
            );
            setInvitations((prev) => [result.invitation, ...prev]);
            setEmail('');
            if (result.emailSent) {
                setLastLink(undefined);
                notify.success('Invitación enviada', normalizedEmail);
            } else {
                setLastLink(result.inviteLink);
                notify.success(
                    'Invitación creada',
                    'No hay correo configurado: copia el enlace y compártelo.'
                );
            }
        } catch (err) {
            notify.error('No se pudo invitar', invitationErrorMessage(err));
        } finally {
            setBusy(false);
        }
    }, [diagramId, normalizedEmail, emailRole, emailValid]);

    const mutate = useCallback(
        async (action: () => Promise<unknown>, success?: string) => {
            setBusy(true);
            try {
                await action();
                if (success) notify.success(success);
                await reload();
            } catch (err) {
                notify.error(
                    'No se pudo completar la acción',
                    invitationErrorMessage(err)
                );
            } finally {
                setBusy(false);
            }
        },
        [reload]
    );

    const handleResend = (invitation: DiagramInvitation) =>
        mutate(async () => {
            const result = await collaborationApi.resendInvitation(
                diagramId,
                invitation.id
            );
            setLastLink(result.emailSent ? undefined : result.inviteLink);
        }, 'Invitación reenviada');

    const handleLeave = async () => {
        setBusy(true);
        try {
            await collaborationApi.leaveDiagram(diagramId);
            notify.success('Has abandonado el diagrama');
            closeShareDiagramDialog();
            onChanged?.();
            navigate('/');
        } catch (err) {
            notify.error('No se pudo abandonar', invitationErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const copyLink = async () => {
        if (!lastLink) return;
        try {
            await navigator.clipboard.writeText(lastLink);
            notify.success('Enlace copiado');
        } catch {
            notify.error('No se pudo copiar', lastLink);
        }
    };

    const owner = access?.owner;
    const ownerIsMe = owner?.id === user?.id;

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) closeShareDiagramDialog();
            }}
        >
            <DialogContent className="flex max-w-lg flex-col gap-4" showClose>
                <DialogHeader>
                    <DialogTitle className="truncate">
                        Compartir “{diagramName}”
                    </DialogTitle>
                    <DialogDescription>
                        {isOwner
                            ? 'Da acceso a un usuario del sistema o invita a alguien por correo.'
                            : 'Personas con acceso a este diagrama.'}
                    </DialogDescription>
                </DialogHeader>

                {isOwner && access && (
                    <Tabs defaultValue="users" className="flex flex-col gap-3">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="users" className="gap-1.5">
                                <UserPlus className="size-3.5" aria-hidden />
                                Usuarios del sistema
                            </TabsTrigger>
                            <TabsTrigger value="email" className="gap-1.5">
                                <Mail className="size-3.5" aria-hidden />
                                Por correo
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="users" className="mt-0">
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <UserPicker
                                        diagramId={diagramId}
                                        value={pickedUser}
                                        onChange={setPickedUser}
                                        disabled={busy}
                                    />
                                </div>
                                <RoleSelect
                                    value={userRole}
                                    onChange={setUserRole}
                                    disabled={busy}
                                    label="Rol del usuario"
                                />
                                <Button
                                    className="h-9"
                                    disabled={!pickedUser || busy}
                                    onClick={() => void handleShareWithUser()}
                                >
                                    Compartir
                                </Button>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Obtiene acceso al instante y recibe una
                                notificación en la app.
                            </p>
                        </TabsContent>

                        <TabsContent value="email" className="mt-0">
                            <form
                                className="flex items-center gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleInviteByEmail();
                                }}
                            >
                                <Input
                                    type="email"
                                    aria-label="Correo de la persona"
                                    placeholder="correo@ejemplo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={busy}
                                    className="h-9 min-w-0 flex-1"
                                    autoComplete="off"
                                />
                                <RoleSelect
                                    value={emailRole}
                                    onChange={setEmailRole}
                                    disabled={busy}
                                    label="Rol de la invitación"
                                />
                                <Button
                                    type="submit"
                                    className="h-9"
                                    disabled={!emailValid || busy}
                                >
                                    Enviar invitación
                                </Button>
                            </form>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Sirve también para quien aún no tiene cuenta.
                                Debe aceptar la invitación; caduca en 7 días.
                            </p>
                            {lastLink && (
                                <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-2">
                                    <Input
                                        readOnly
                                        value={lastLink}
                                        aria-label="Enlace de invitación"
                                        className="h-8 flex-1 font-mono text-xs"
                                        onFocus={(e) =>
                                            e.currentTarget.select()
                                        }
                                    />
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 gap-1.5"
                                        onClick={() => void copyLink()}
                                    >
                                        <Copy className="size-3.5" />
                                        Copiar enlace
                                    </Button>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}

                <section aria-labelledby={`${ids}-people`}>
                    <h3
                        id={`${ids}-people`}
                        className="mb-2 text-sm font-semibold"
                    >
                        Personas con acceso
                    </h3>
                    {loading && !access ? (
                        <div className="flex justify-center py-6">
                            <Spinner size="small" />
                        </div>
                    ) : (
                        <ul className="flex max-h-64 flex-col gap-1 overflow-auto">
                            {owner && (
                                <li className="flex items-center gap-3 py-1.5">
                                    <PersonAvatar
                                        name={owner.displayName}
                                        email={owner.displayName ?? '?'}
                                        avatarUrl={owner.avatarUrl}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                        {owner.displayName ?? 'Propietario'}
                                        {ownerIsMe && (
                                            <span className="text-muted-foreground">
                                                {' '}
                                                (tú)
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {accessRoleLabel('owner')}
                                    </span>
                                </li>
                            )}
                            {members.map((m) => {
                                const isMe = m.sharedWith === user?.id;
                                const name = m.displayName ?? 'Usuario';
                                return (
                                    <li
                                        key={m.id}
                                        className="flex items-center gap-3 py-1.5"
                                    >
                                        <PersonAvatar
                                            name={m.displayName}
                                            email={name}
                                            avatarUrl={m.avatarUrl}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">
                                            {name}
                                            {isMe && (
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    (tú)
                                                </span>
                                            )}
                                        </span>
                                        {isOwner ? (
                                            <>
                                                <RoleSelect
                                                    value={m.role}
                                                    disabled={busy}
                                                    label={`Rol de ${name}`}
                                                    onChange={(next) =>
                                                        void mutate(
                                                            () =>
                                                                collaborationApi.updateMemberRole(
                                                                    diagramId,
                                                                    m.id,
                                                                    next
                                                                ),
                                                            'Rol actualizado'
                                                        )
                                                    }
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 text-muted-foreground hover:text-destructive"
                                                    aria-label={`Quitar acceso a ${name}`}
                                                    title="Quitar acceso"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void mutate(
                                                            () =>
                                                                collaborationApi.removeMember(
                                                                    diagramId,
                                                                    m.id
                                                                ),
                                                            'Acceso retirado'
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                {accessRoleLabel(m.role)}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                            {!loading && !owner && members.length === 0 && (
                                <li className="py-2 text-sm text-muted-foreground">
                                    Nadie más tiene acceso todavía.
                                </li>
                            )}
                        </ul>
                    )}
                </section>

                {isOwner && invitations.length > 0 && (
                    <section aria-labelledby={`${ids}-pending`}>
                        <h3
                            id={`${ids}-pending`}
                            className="mb-2 text-sm font-semibold"
                        >
                            Invitaciones por correo pendientes
                        </h3>
                        <ul className="flex flex-col gap-1">
                            {invitations.map((inv) => (
                                <li
                                    key={inv.id}
                                    className="flex items-center gap-3 py-1.5 text-sm"
                                >
                                    <Mail
                                        className="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">
                                            {inv.email}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {accessRoleLabel(inv.role)} · caduca
                                            en {daysLeft(inv.expiresAt)} días
                                        </span>
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-muted-foreground"
                                        aria-label={`Reenviar invitación a ${inv.email}`}
                                        title="Reenviar"
                                        disabled={busy}
                                        onClick={() => void handleResend(inv)}
                                    >
                                        <RotateCw className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-muted-foreground hover:text-destructive"
                                        aria-label={`Revocar invitación a ${inv.email}`}
                                        title="Revocar"
                                        disabled={busy}
                                        onClick={() =>
                                            void mutate(
                                                () =>
                                                    collaborationApi.revokeInvitation(
                                                        diagramId,
                                                        inv.id
                                                    ),
                                                'Invitación revocada'
                                            )
                                        }
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {!isOwner && (
                    <div className="flex justify-end border-t pt-3">
                        <Button
                            variant="outline"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            disabled={busy}
                            onClick={() => void handleLeave()}
                        >
                            <LogOut className="size-4" />
                            Abandonar diagrama
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
