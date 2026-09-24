import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import {
    initialsOf,
    invitationErrorMessage,
    isValidEmail,
    notificationView,
} from '../share-helpers';

describe('isValidEmail', () => {
    it('accepts normal addresses and trims', () => {
        expect(isValidEmail(' ana@example.com ')).toBe(true);
    });
    it('rejects partial input', () => {
        expect(isValidEmail('ana')).toBe(false);
        expect(isValidEmail('ana@')).toBe(false);
        expect(isValidEmail('ana@example')).toBe(false);
    });
});

describe('invitationErrorMessage', () => {
    it('explains known API error codes in Spanish', () => {
        expect(
            invitationErrorMessage(new ApiError('x', 409, 'invitation_exists'))
        ).toMatch(/invitación pendiente/i);
        expect(
            invitationErrorMessage(new ApiError('x', 409, 'already_member'))
        ).toMatch(/ya tiene acceso/i);
        expect(
            invitationErrorMessage(new ApiError('x', 429, 'rate_limited'))
        ).toMatch(/demasiad/i);
    });

    it('tells the user when the database migration is missing', () => {
        expect(
            invitationErrorMessage(new ApiError('x', 503, 'migration_pending'))
        ).toMatch(/migraci/i);
    });

    it('falls back to a generic message', () => {
        expect(invitationErrorMessage(new Error('boom'))).toMatch(
            /no se pudo/i
        );
    });
});

describe('initialsOf', () => {
    it('uses up to two initials from the display name', () => {
        expect(initialsOf('Ana María Pérez', 'x@y.com')).toBe('AM');
        expect(initialsOf('ana', 'x@y.com')).toBe('A');
    });
    it('falls back to the email', () => {
        expect(initialsOf(null, 'juan@y.com')).toBe('J');
    });
});

describe('notificationView', () => {
    const base = {
        id: 'n1',
        diagramId: 'd1',
        readAt: null,
        createdAt: '2026-09-24T10:00:00.000Z',
    };

    it('describes a direct share and links to the diagram', () => {
        const view = notificationView({
            ...base,
            type: 'diagram_shared',
            payload: { by_name: 'Ana', diagram_name: 'Ventas', role: 'editor' },
        });
        expect(view.text).toBe('Ana compartió “Ventas” contigo como editor.');
        expect(view.href).toBe('/diagrams/d1');
    });

    it('offers accept/decline for an email invitation', () => {
        const view = notificationView({
            ...base,
            type: 'invitation_received',
            payload: {
                by_name: 'Ana',
                diagram_name: 'Ventas',
                role: 'viewer',
                invitation_id: 'i1',
            },
        });
        expect(view.text).toMatch(/Ana te invitó a “Ventas” como lector/);
        expect(view.invitationId).toBe('i1');
        expect(view.href).toBeUndefined();
    });

    it('does not link to a diagram the user lost access to', () => {
        const view = notificationView({
            ...base,
            type: 'access_removed',
            payload: { by_name: 'Ana', diagram_name: 'Ventas' },
        });
        expect(view.text).toMatch(/quitó tu acceso a “Ventas”/);
        expect(view.href).toBeUndefined();
    });

    it('covers the owner-side events', () => {
        expect(
            notificationView({
                ...base,
                type: 'invitation_accepted',
                payload: { member_name: 'Juan', diagram_name: 'Ventas' },
            }).text
        ).toMatch(/Juan aceptó tu invitación a “Ventas”/);
        expect(
            notificationView({
                ...base,
                type: 'member_left',
                payload: { member_name: 'Juan', diagram_name: 'Ventas' },
            }).text
        ).toMatch(/Juan abandonó “Ventas”/);
        expect(
            notificationView({
                ...base,
                type: 'role_changed',
                payload: {
                    by_name: 'Ana',
                    diagram_name: 'Ventas',
                    role: 'viewer',
                },
            }).text
        ).toMatch(/ahora eres lector en “Ventas”/);
    });

    it('survives unknown types and missing payload fields', () => {
        expect(
            notificationView({ ...base, type: 'future_type', payload: {} }).text
        ).toBeTruthy();
    });
});
