import { describe, expect, it, vi } from 'vitest';
import { areFieldTypesCompatible } from '@/lib/data/data-types/data-types';
import { DatabaseType } from '@/lib/domain/database-type';

vi.mock('@/lib/notifications', () => ({
    notify: { error: vi.fn() },
}));

describe('canvas relationship creation — incompatible field types', () => {
    it('flags varchar -> integer as incompatible so the toast path is reachable', () => {
        const compatible = areFieldTypesCompatible(
            { id: 'varchar', name: 'varchar' },
            { id: 'integer', name: 'integer' },
            DatabaseType.GENERIC
        );
        expect(compatible).toBeFalsy();
    });
});
