import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, LogOut, Mail, RotateCw, Trash2, X } from 'lucide-react';
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
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/avatar/avatar';
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
    initialsOf,
    invitationErrorMessage,
    resolveInviteEmail,
} from '@/lib/collaboration/share-helpers';
import type { BaseDialogProps } from '../common/base-dialog-props';

export interface ShareDiagramDialogProps extends BaseDialogProps {
    diagramId: string;
    diagramName: string;
    /** Se llama tras cambios que afectan a la lista de diagramas (abandonar). */
    onChanged?: () => void;
}

const SEARCH_DEBOUNCE_MS = 250;

const PersonAvatar: React.FC<{
    name: string | null;
    email: string;
    avatarUrl?: string | null;
}> = ({ name, email, avatarUrl }) => (
    <Avatar className="size-8">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xs font-medium">
            {initialsOf(name, email)}
        </AvatarFallback>
    </Avatar>
);

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
        <SelectTrigger className="h-8 w-[108px]" aria-label={label}>
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
    const listboxId = useId();

    const [loading, setLoading] = useState(false);
    const [access, setAccess] = useState<DiagramAccessInfo>();
    const [members, setMembers] = useState<DiagramMember[]>([]);
    const [invitations, setInvitations] = useState<DiagramInvitation[]>([]);

    const [query, setQuery] = useState('');
    const [role, setRole] = useState<MemberRole>('editor');
    const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [picked, setPicked] = useState<ShareCandidate>();
    const [busy, setBusy] = useState(false);
    const [lastLink, setLastLink] = useState<string>();
    const [announcement, setAnnouncement] = useState('');
    const searchAbort = useRef<AbortController>();

    const isOwner = access?.accessRole === 'owner' || !access?.accessRole;

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const info = await collaborationApi.getDiagramAccess(diagramId);
            setAccess(info);
            const [nextMembers, nextInvitations] = await Promise.all([
                collaborationApi.listMembers(diagramId),
                info.accessRole === 'owner' || !info.accessRole
                    ? collaborationApi.listInvitations(diagramId)
                    : Promise.resolve([]),
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
        setQuery('');
        setPicked(undefined);
        setCandidates([]);
        setLastLink(undefined);
        void reload();
    }, [dialog.open, reload]);

    // Autocompletado con debounce; se cancela la petición anterior.
    useEffect(() => {
        if (!isOwner || picked) return;
        const q = query.trim();
        if (q.length < 3) {
            setCandidates([]);
            return;
        }
        const timer = setTimeout(async () => {
            searchAbort.current?.abort();
            const controller = new AbortController();
            searchAbort.current = controller;
            try {
                const result = await collaborationApi.searchCandidates(
                    diagramId,
                    q,
                    controller.signal
                );
                setCandidates(result);
                setActiveIndex(-1);
                setAnnouncement(
                    result.length === 0
                        ? 'Sin coincidencias'
                        : `${result.length} coincidencias`
                );
            } catch {
                // abortada o error de red: se deja la lista anterior
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query, diagramId, isOwner, picked]);

    const inviteEmail = resolveInviteEmail(query, picked);

    const handleInvite = useCallback(async () => {
        if (!inviteEmail) return;
        setBusy(true);
        try {
            const result = await collaborationApi.invite(
                diagramId,
                inviteEmail,
                role
            );
            setInvitations((prev) => [result.invitation, ...prev]);
            setQuery('');
            setPicked(undefined);
            setCandidates([]);
            if (result.emailSent) {
                setLastLink(undefined);
                notify.success('Invitación enviada', inviteEmail);
            } else {
                setLastLink(result.inviteLink);
                notify.success(
                    'Invitación creada',
                    'Copia el enlace y compártelo con esa persona.'
                );
            }
        } catch (err) {
            notify.error('No se pudo invitar', invitationErrorMessage(err));
        } finally {
            setBusy(false);
        }
    }, [diagramId, inviteEmail, role]);

    const pickCandidate = (candidate: ShareCandidate) => {
        setPicked(candidate);
        setQuery(candidate.emailExact ? candidate.email : query);
        setCandidates([]);
    };

    const onQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' && candidates.length > 0) {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % candidates.length);
        } else if (e.key === 'ArrowUp' && candidates.length > 0) {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? candidates.length - 1 : i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && candidates[activeIndex]) {
                pickCandidate(candidates[activeIndex]);
            } else if (inviteEmail) {
                void handleInvite();
            }
        } else if (e.key === 'Escape' && candidates.length > 0) {
            e.stopPropagation();
            setCandidates([]);
        }
    };

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
    const showListbox = isOwner && !picked && candidates.length > 0;

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
                            ? 'Invita a otras personas a ver o editar este diagrama.'
                            : 'Personas con acceso a este diagrama.'}
                    </DialogDescription>
                </DialogHeader>

                {isOwner && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            <div className="relative flex-1">
                                <Input
                                    role="combobox"
                                    aria-label="Nombre o correo de la persona"
                                    aria-expanded={showListbox}
                                    aria-controls={listboxId}
                                    aria-autocomplete="list"
                                    aria-activedescendant={
                                        activeIndex >= 0
                                            ? `${listboxId}-${activeIndex}`
                                            : undefined
                                    }
                                    placeholder="Nombre o correo…"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setPicked(undefined);
                                    }}
                                    onKeyDown={onQueryKeyDown}
                                    disabled={busy}
                                    autoComplete="off"
                                />
                                {showListbox && (
                                    <ul
                                        id={listboxId}
                                        role="listbox"
                                        className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md"
                                    >
                                        {candidates.map((c, i) => (
                                            <li
                                                key={c.userId}
                                                id={`${listboxId}-${i}`}
                                                role="option"
                                                aria-selected={
                                                    i === activeIndex
                                                }
                                                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                                                    i === activeIndex
                                                        ? 'bg-accent'
                                                        : 'hover:bg-accent/60'
                                                }`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    pickCandidate(c);
                                                }}
                                            >
                                                <PersonAvatar
                                                    name={c.displayName}
                                                    email={c.email}
                                                    avatarUrl={c.avatarUrl}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-medium">
                                                        {c.displayName ??
                                                            c.email}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {c.email}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <RoleSelect
                                value={role}
                                onChange={setRole}
                                disabled={busy}
                                label="Rol de la invitación"
                            />
                            <Button
                                onClick={() => void handleInvite()}
                                disabled={!inviteEmail || busy}
                                className="h-9"
                            >
                                Invitar
                            </Button>
                        </div>
                        <p className="min-h-4 text-xs text-muted-foreground">
                            {picked && !picked.emailExact && !inviteEmail
                                ? 'Escribe el correo completo de esta persona para invitarla.'
                                : inviteEmail
                                  ? `Se invitará a ${inviteEmail}`
                                  : ''}
                        </p>
                        <span className="sr-only" aria-live="polite">
                            {announcement}
                        </span>
                        {lastLink && (
                            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-2">
                                <Input
                                    readOnly
                                    value={lastLink}
                                    aria-label="Enlace de invitación"
                                    className="h-8 flex-1 font-mono text-xs"
                                    onFocus={(e) => e.currentTarget.select()}
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
                    </div>
                )}

                <section aria-labelledby={`${listboxId}-people`}>
                    <h3
                        id={`${listboxId}-people`}
                        className="mb-2 text-sm font-semibold"
                    >
                        Personas con acceso
                    </h3>
                    {loading && !access ? (
                        <div className="flex justify-center py-6">
                            <Spinner size="small" />
                        </div>
                    ) : (
                        <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
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
                    <section aria-labelledby={`${listboxId}-pending`}>
                        <h3
                            id={`${listboxId}-pending`}
                            className="mb-2 text-sm font-semibold"
                        >
                            Invitaciones pendientes
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
