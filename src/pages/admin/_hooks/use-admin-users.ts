import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api-client';
import { IS_API_ENABLED } from '@/lib/env';
import type { AdminUserProfile } from '../_types/admin.types';

export const useAdminUsers = () => {
    const [users, setUsers] = useState<AdminUserProfile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            if (IS_API_ENABLED) {
                const data = await apiFetch<AdminUserProfile[]>(
                    '/admin/users'
                );
                setUsers(data || []);
            } else {
                const { data, error: supabaseError } =
                    await supabase.rpc('get_admin_users');
                if (supabaseError) throw supabaseError;
                setUsers((data || []) as AdminUserProfile[]);
            }
        } catch (err) {
            console.error('Error fetching admin users:', err);
            setError(
                err instanceof Error
                    ? err
                    : new Error('Unknown error fetching users')
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    return { users, loading, error, refetch: fetchUsers };
};
