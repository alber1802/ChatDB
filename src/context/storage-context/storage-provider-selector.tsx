import React from 'react';
import { IS_SUPABASE_ENABLED } from '@/lib/env';
import { useAuth } from '@/context/auth-context/auth-context';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import { StorageProvider } from './storage-provider';

export const StorageProviderSelector: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { user } = useAuth();

    if (IS_SUPABASE_ENABLED && user) {
        return <SupabaseStorageProvider>{children}</SupabaseStorageProvider>;
    }

    return <StorageProvider>{children}</StorageProvider>;
};
export default StorageProviderSelector;
