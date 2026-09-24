import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import {
    initialsOf,
    invitationErrorMessage,
    isValidEmail,
    resolveInviteEmail,
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

describe('resolveInviteEmail', () => {
    it('uses the exact email of a picked candidate', () => {
        expect(
            resolveInviteEmail('ana', {
                email: 'ana@example.com',
                emailExact: true,
            })
        ).toBe('ana@example.com');
    });

    it('never sends a masked email: falls back to the typed text', () => {
        expect(
            resolveInviteEmail('Ana@Example.com', {
                email: 'a***@example.com',
                emailExact: false,
            })
        ).toBe('ana@example.com');
    });

    it('returns null when there is no valid email to invite', () => {
        expect(
            resolveInviteEmail('Ana Pérez', {
                email: 'a***@example.com',
                emailExact: false,
            })
        ).toBeNull();
        expect(resolveInviteEmail('ana', undefined)).toBeNull();
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
