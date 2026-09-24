import { describe, expect, it } from 'vitest';
import {
    accessRoleLabel,
    canEditDiagram,
    canManageDiagram,
    resolveReadonly,
} from '../diagram-access';

describe('diagram access helpers', () => {
    it('treats a diagram without accessRole as owned (older API responses)', () => {
        expect(canManageDiagram({})).toBe(true);
        expect(canEditDiagram({})).toBe(true);
    });

    it('owner can edit and manage', () => {
        expect(canEditDiagram({ accessRole: 'owner' })).toBe(true);
        expect(canManageDiagram({ accessRole: 'owner' })).toBe(true);
    });

    it('editor can edit but not manage', () => {
        expect(canEditDiagram({ accessRole: 'editor' })).toBe(true);
        expect(canManageDiagram({ accessRole: 'editor' })).toBe(false);
    });

    it('viewer can neither edit nor manage', () => {
        expect(canEditDiagram({ accessRole: 'viewer' })).toBe(false);
        expect(canManageDiagram({ accessRole: 'viewer' })).toBe(false);
    });

    it('labels roles in Spanish', () => {
        expect(accessRoleLabel('owner')).toBe('Propietario');
        expect(accessRoleLabel('editor')).toBe('Editor');
        expect(accessRoleLabel('viewer')).toBe('Lector');
    });
});

describe('resolveReadonly', () => {
    it('an explicit readonly prop always wins', () => {
        expect(
            resolveReadonly({
                readonlyProp: false,
                hasDiff: true,
                accessRole: 'viewer',
            })
        ).toBe(false);
        expect(
            resolveReadonly({
                readonlyProp: true,
                hasDiff: false,
                accessRole: 'owner',
            })
        ).toBe(true);
    });

    it('a viewer is readonly', () => {
        expect(resolveReadonly({ hasDiff: false, accessRole: 'viewer' })).toBe(
            true
        );
    });

    it('a pending diff is readonly', () => {
        expect(resolveReadonly({ hasDiff: true, accessRole: 'owner' })).toBe(
            true
        );
    });

    it('owner/editor without diff can edit', () => {
        expect(resolveReadonly({ hasDiff: false, accessRole: 'editor' })).toBe(
            false
        );
        expect(resolveReadonly({ hasDiff: false })).toBe(false);
    });
});
