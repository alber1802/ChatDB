import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Mail, X } from 'lucide-react';
import { Button } from '@/components/button/button';
import { notify } from '@/lib/notifications';
import { accessRoleLabel } from '@/lib/domain/diagram-access';
import {
    collaborationApi,
    pendingInviteToken,
    type MyInvitation,
} from '@/lib/collaboration/collaboration-api';
import { invitationErrorMessage } from '@/lib/collaboration/share-helpers';

/**
 * Invitaciones pendientes del usuario actual. También acepta el token de un
 * enlace /invite/:token que se abrió sin sesión (ver InvitePage).
 */
export const PendingInvitations: React.FC<{ onAccepted: () => void }> = ({
    onAccepted,
}) => {
    const navigate = useNavigate();
    const [invitations, setInvitations] = useState<MyInvitation[]>([]);
    const [busyId, setBusyId] = useState<string>();
    const tokenHandled = useRef(false);

    const load = useCallback(async () => {
        try {
            setInvitations(await collaborationApi.listMyInvitations());
        } catch {
            // Sin backend de invitaciones (migración no aplicada): no se muestra nada.
            setInvitations([]);
        }
    }, []);

    useEffect(() => {
        if (tokenHandled.current) return;
        tokenHandled.current = true;
        const token = pendingInviteToken.take();
        if (!token) {
            void load();
            return;
        }
        collaborationApi
            .acceptInvitationByToken(token)
            .then(({ diagramId }) => navigate(`/diagrams/${diagramId}`))
            .catch((err) => {
                notify.error(
                    'No se pudo aceptar la invitación',
                    invitationErrorMessage(err)
                );
                void load();
            });
    }, [load, navigate]);

    const respond = async (invitation: MyInvitation, accept: boolean) => {
        setBusyId(invitation.id);
        try {
            if (accept) {
                await collaborationApi.acceptInvitation(invitation.id);
                notify.success(
                    'Invitación aceptada',
                    `Ya puedes abrir “${invitation.diagramName}”.`
                );
                onAccepted();
            } else {
                await collaborationApi.declineInvitation(invitation.id);
            }
            setInvitations((prev) =>
                prev.filter((i) => i.id !== invitation.id)
            );
        } catch (err) {
            notify.error(
                'No se pudo responder a la invitación',
                invitationErrorMessage(err)
            );
            void load();
        } finally {
            setBusyId(undefined);
        }
    };

    if (invitations.length === 0) return null;

    return (
        <section
            aria-labelledby="pending-invitations-title"
            className="mb-6 rounded-xl border border-primary/25 bg-primary/5 p-4"
        >
            <h2
                id="pending-invitations-title"
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
            >
                <Mail className="size-4 text-primary" aria-hidden />
                Invitaciones ({invitations.length})
            </h2>
            <ul className="flex flex-col gap-2">
                {invitations.map((inv) => (
                    <li
                        key={inv.id}
                        className="flex flex-col gap-2 rounded-lg bg-card/70 p-3 sm:flex-row sm:items-center"
                    >
                        <p className="min-w-0 flex-1 text-sm">
                            <strong className="font-medium">
                                {inv.invitedBy.displayName ?? 'Alguien'}
                            </strong>{' '}
                            te invitó como{' '}
                            {accessRoleLabel(inv.role).toLowerCase()} a{' '}
                            <strong className="font-medium">
                                “{inv.diagramName}”
                            </strong>
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="h-8 gap-1.5"
                                disabled={busyId === inv.id}
                                onClick={() => void respond(inv, true)}
                            >
                                <Check className="size-3.5" />
                                Aceptar
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1.5"
                                disabled={busyId === inv.id}
                                onClick={() => void respond(inv, false)}
                            >
                                <X className="size-3.5" />
                                Rechazar
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};
