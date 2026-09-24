import { ApiError } from '@/lib/api-client';
import type { AppNotification } from './collaboration-api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value: string): boolean =>
    EMAIL_RE.test(value.trim());

const ERROR_MESSAGES: Record<string, string> = {
    invitation_exists: 'Ya hay una invitación pendiente para ese correo.',
    already_member: 'Esa persona ya tiene acceso al diagrama.',
    cannot_invite_self: 'No puedes invitarte a ti mismo.',
    not_owner: 'Solo el propietario puede gestionar el acceso.',
    invitation_not_found: 'La invitación ya no existe o fue revocada.',
    invitation_expired: 'La invitación ha caducado. Pide que te la reenvíen.',
    invitation_email_mismatch:
        'Esta invitación se envió a otro correo. Inicia sesión con esa cuenta.',
    rate_limited:
        'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
    validation_error: 'Revisa los datos introducidos.',
    forbidden_role: 'Tu acceso a este diagrama es de solo lectura.',
    user_not_found: 'Ese usuario no existe o está bloqueado.',
    migration_pending:
        'Falta aplicar una migración de base de datos para usar esta función. Avisa al administrador.',
};

export function invitationErrorMessage(err: unknown): string {
    if (err instanceof ApiError && err.code && ERROR_MESSAGES[err.code]) {
        return ERROR_MESSAGES[err.code];
    }
    return 'No se pudo completar la acción. Inténtalo de nuevo.';
}

export function initialsOf(
    displayName: string | null | undefined,
    email: string
): string {
    const source = displayName?.trim() || email;
    return source
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join('');
}

const ROLE_NOUN: Record<string, string> = {
    editor: 'editor',
    viewer: 'lector',
};

export interface NotificationView {
    text: string;
    /** Destino al hacer clic; ausente si el usuario ya no tiene acceso. */
    href?: string;
    /** Presente en invitaciones por email: se ofrece Aceptar/Rechazar. */
    invitationId?: string;
}

export function notificationView(n: AppNotification): NotificationView {
    const p = n.payload as Record<string, string | undefined>;
    const diagram = `“${p.diagram_name ?? 'un diagrama'}”`;
    const by = p.by_name ?? 'Alguien';
    const member = p.member_name ?? 'Un miembro';
    const role = ROLE_NOUN[p.role ?? ''] ?? p.role ?? '';
    const href = n.diagramId ? `/diagrams/${n.diagramId}` : undefined;

    switch (n.type) {
        case 'diagram_shared':
            return {
                text: `${by} compartió ${diagram} contigo como ${role}.`,
                href,
            };
        case 'invitation_received':
            return {
                text: `${by} te invitó a ${diagram} como ${role}.`,
                invitationId: p.invitation_id,
            };
        case 'invitation_accepted':
            return {
                text: `${member} aceptó tu invitación a ${diagram}.`,
                href,
            };
        case 'role_changed':
            return {
                text: `${by} cambió tu rol: ahora eres ${role} en ${diagram}.`,
                href,
            };
        case 'access_removed':
            return { text: `${by} quitó tu acceso a ${diagram}.` };
        case 'member_left':
            return { text: `${member} abandonó ${diagram}.`, href };
        default:
            return { text: 'Hay novedades en uno de tus diagramas.', href };
    }
}
