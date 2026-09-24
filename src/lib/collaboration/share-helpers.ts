import { ApiError } from '@/lib/api-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value: string): boolean =>
    EMAIL_RE.test(value.trim());

/**
 * Email al que se enviará la invitación. El autocompletado devuelve emails
 * enmascarados (`a***@dominio.com`) salvo coincidencia exacta, así que un
 * candidato enmascarado nunca se usa como destinatario: en ese caso se invita
 * a lo que el usuario escribió, si es un email válido.
 */
export function resolveInviteEmail(
    typed: string,
    candidate: { email: string; emailExact: boolean } | undefined
): string | null {
    if (candidate?.emailExact) return candidate.email.toLowerCase();
    const normalized = typed.trim().toLowerCase();
    return isValidEmail(normalized) ? normalized : null;
}

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
