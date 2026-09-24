import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/button/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/popover/popover';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import {
    collaborationApi,
    notifyDiagramsChanged,
    type AppNotification,
} from '@/lib/collaboration/collaboration-api';
import {
    invitationErrorMessage,
    notificationView,
} from '@/lib/collaboration/share-helpers';

// Sin tiempo real todavía (Fase 3): se consulta cada 30 s y al volver a la
// pestaña. Cuando exista el WebSocket, este intervalo se sustituye por push.
const POLL_MS = 30_000;

const timeAgo = (iso: string) => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    return `hace ${Math.round(hours / 24)} d`;
};

export const NotificationsBell: React.FC<{ className?: string }> = ({
    className,
}) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<AppNotification[]>([]);
    const [unread, setUnread] = useState(0);
    const [busyId, setBusyId] = useState<string>();
    const available = useRef(true);

    const load = useCallback(async () => {
        if (!available.current) return;
        try {
            const data = await collaborationApi.listNotifications(20);
            setItems(data.items);
            setUnread(data.unreadCount);
        } catch {
            // Sin migración de notificaciones o sin red: no insistir con errores.
        }
    }, []);

    useEffect(() => {
        void load();
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') void load();
        }, POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') void load();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);

    // Al abrir, lo visible se da por leído (el contador vuelve a 0 al instante).
    useEffect(() => {
        if (!open) return;
        const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
        if (unreadIds.length === 0) return;
        setUnread(0);
        collaborationApi.markNotificationsRead(unreadIds).catch(() => {});
    }, [open, items]);

    const respond = async (
        notification: AppNotification,
        invitationId: string,
        accept: boolean
    ) => {
        setBusyId(notification.id);
        try {
            if (accept) {
                const { diagramId } =
                    await collaborationApi.acceptInvitation(invitationId);
                notifyDiagramsChanged();
                setOpen(false);
                navigate(`/diagrams/${diagramId}`);
            } else {
                await collaborationApi.declineInvitation(invitationId);
            }
            setItems((prev) => prev.filter((n) => n.id !== notification.id));
        } catch (err) {
            notify.error(
                'No se pudo responder a la invitación',
                invitationErrorMessage(err)
            );
        } finally {
            setBusyId(undefined);
        }
    };

    const label =
        unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    title={label}
                    className={cn(
                        'relative size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
                        className
                    )}
                >
                    <Bell className="size-4" />
                    {unread > 0 && (
                        <span
                            aria-hidden
                            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                        >
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b px-3 py-2 text-sm font-semibold">
                    Notificaciones
                </div>
                {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No tienes notificaciones.
                    </p>
                ) : (
                    <ul className="max-h-96 overflow-auto py-1">
                        {items.map((n) => {
                            const view = notificationView(n);
                            // Accionable mientras la invitación siga pendiente, aunque ya se
                            // haya leído (el trigger marca payload.resolved al resolverse).
                            const pendingInvitation =
                                view.invitationId && !n.payload.resolved;
                            const body = (
                                <>
                                    <p className="text-sm leading-snug">
                                        {view.text}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {timeAgo(n.createdAt)}
                                    </p>
                                </>
                            );
                            return (
                                <li
                                    key={n.id}
                                    className={cn(
                                        'border-l-2 px-3 py-2',
                                        n.readAt
                                            ? 'border-transparent'
                                            : 'border-primary bg-primary/5'
                                    )}
                                >
                                    {view.href ? (
                                        <button
                                            type="button"
                                            className="w-full text-left hover:opacity-80"
                                            onClick={() => {
                                                setOpen(false);
                                                navigate(view.href!);
                                            }}
                                        >
                                            {body}
                                        </button>
                                    ) : (
                                        body
                                    )}
                                    {pendingInvitation && (
                                        <div className="mt-2 flex gap-2">
                                            <Button
                                                size="sm"
                                                className="h-7"
                                                disabled={busyId === n.id}
                                                onClick={() =>
                                                    void respond(
                                                        n,
                                                        view.invitationId!,
                                                        true
                                                    )
                                                }
                                            >
                                                Aceptar
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7"
                                                disabled={busyId === n.id}
                                                onClick={() =>
                                                    void respond(
                                                        n,
                                                        view.invitationId!,
                                                        false
                                                    )
                                                }
                                            >
                                                Rechazar
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </PopoverContent>
        </Popover>
    );
};
