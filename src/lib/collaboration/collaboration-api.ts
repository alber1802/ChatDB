import { apiFetch } from '@/lib/api-client';
import type {
    DiagramAccessRole,
    DiagramOwner,
} from '@/lib/domain/diagram-access';

// Cliente de la API de colaboración (server/src/modules/shares, invitations).
// Ver docs/collaboration/02-sharing-and-permissions.md.

export type MemberRole = Exclude<DiagramAccessRole, 'owner'>;

export interface DiagramMember {
    id: string;
    sharedWith: string;
    role: MemberRole;
    createdAt: string;
    displayName: string | null;
    avatarUrl: string | null;
}

export interface DiagramInvitation {
    id: string;
    email: string;
    role: MemberRole;
    status: string;
    expiresAt: string;
    createdAt: string;
}

export interface MyInvitation {
    id: string;
    diagramId: string;
    diagramName: string;
    role: MemberRole;
    expiresAt: string;
    createdAt: string;
    invitedBy: { displayName: string | null; avatarUrl: string | null };
}

export interface ShareCandidate {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    email: string;
}

export interface AppNotification {
    id: string;
    type: string;
    diagramId: string | null;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
}

export interface InvitationDelivery {
    invitation: DiagramInvitation;
    inviteLink: string;
    emailSent: boolean;
}

export interface DiagramAccessInfo {
    id: string;
    name: string;
    accessRole?: DiagramAccessRole;
    owner?: DiagramOwner;
}

const enc = encodeURIComponent;

export const collaborationApi = {
    getDiagramAccess: (diagramId: string) =>
        apiFetch<DiagramAccessInfo>(`/diagrams/${enc(diagramId)}`),

    /** Compartir directamente con un usuario del sistema (con notificación interna). */
    shareWithUser: (diagramId: string, userId: string, role: MemberRole) =>
        apiFetch<{ id: string }>(`/diagrams/${enc(diagramId)}/shares`, {
            method: 'POST',
            body: JSON.stringify({ userId, role }),
        }),

    listMembers: (diagramId: string) =>
        apiFetch<DiagramMember[]>(`/diagrams/${enc(diagramId)}/shares`),

    updateMemberRole: (diagramId: string, shareId: string, role: MemberRole) =>
        apiFetch<void>(`/diagrams/${enc(diagramId)}/shares/${enc(shareId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
        }),

    removeMember: (diagramId: string, shareId: string) =>
        apiFetch<void>(`/diagrams/${enc(diagramId)}/shares/${enc(shareId)}`, {
            method: 'DELETE',
        }),

    leaveDiagram: (diagramId: string) =>
        apiFetch<void>(`/diagrams/${enc(diagramId)}/shares/me`, {
            method: 'DELETE',
        }),

    listInvitations: (diagramId: string) =>
        apiFetch<DiagramInvitation[]>(
            `/diagrams/${enc(diagramId)}/invitations`
        ),

    invite: (diagramId: string, email: string, role: MemberRole) =>
        apiFetch<InvitationDelivery>(
            `/diagrams/${enc(diagramId)}/invitations`,
            { method: 'POST', body: JSON.stringify({ email, role }) }
        ),

    resendInvitation: (diagramId: string, invitationId: string) =>
        apiFetch<InvitationDelivery>(
            `/diagrams/${enc(diagramId)}/invitations/${enc(invitationId)}/resend`,
            { method: 'POST' }
        ),

    revokeInvitation: (diagramId: string, invitationId: string) =>
        apiFetch<void>(
            `/diagrams/${enc(diagramId)}/invitations/${enc(invitationId)}`,
            { method: 'DELETE' }
        ),

    searchCandidates: (diagramId: string, q: string, signal?: AbortSignal) =>
        apiFetch<ShareCandidate[]>(
            `/diagrams/${enc(diagramId)}/share-candidates?q=${enc(q)}`,
            { signal }
        ),

    listMyInvitations: () => apiFetch<MyInvitation[]>('/me/invitations'),

    acceptInvitation: (invitationId: string) =>
        apiFetch<{ diagramId: string }>(
            `/invitations/${enc(invitationId)}/accept`,
            { method: 'POST' }
        ),

    acceptInvitationByToken: (token: string) =>
        apiFetch<{ diagramId: string }>('/invitations/accept-by-token', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),

    listNotifications: (limit = 20) =>
        apiFetch<{ items: AppNotification[]; unreadCount: number }>(
            `/me/notifications?limit=${limit}`
        ),

    markNotificationsRead: (ids?: string[]) =>
        apiFetch<void>('/me/notifications/read', {
            method: 'POST',
            body: JSON.stringify(ids ? { ids } : {}),
        }),

    declineInvitation: (invitationId: string) =>
        apiFetch<void>(`/invitations/${enc(invitationId)}/decline`, {
            method: 'POST',
        }),
};

// Token de un enlace /invite/:token abierto sin sesión: se guarda hasta que
// el usuario inicie sesión y el Dashboard lo acepta.
const PENDING_INVITE_KEY = 'chartdb:pending-invite-token';

export const pendingInviteToken = {
    save(token: string) {
        try {
            sessionStorage.setItem(PENDING_INVITE_KEY, token);
        } catch {
            // sessionStorage no disponible: el usuario puede reabrir el enlace
        }
    },
    take(): string | null {
        try {
            const token = sessionStorage.getItem(PENDING_INVITE_KEY);
            sessionStorage.removeItem(PENDING_INVITE_KEY);
            return token;
        } catch {
            return null;
        }
    },
};

// Aviso entre componentes: la lista de diagramas cambió (p.ej. se aceptó una
// invitación desde la campana). El Dashboard escucha y recarga.
export const DIAGRAMS_CHANGED_EVENT = 'chartdb:diagrams-changed';
export const notifyDiagramsChanged = () =>
    window.dispatchEvent(new Event(DIAGRAMS_CHANGED_EVENT));
