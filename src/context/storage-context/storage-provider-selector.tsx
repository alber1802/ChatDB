import React from 'react';
import { IS_API_ENABLED, IS_SUPABASE_ENABLED } from '@/lib/env';
import { useAuth } from '@/context/auth-context/auth-context';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import { ApiStorageProvider } from './api-storage-provider';
import { StorageProvider } from './storage-provider';

/**
 * Storage selection priority:
 * 1. ApiStorageProvider when VITE_API_URL is set and user is logged in
 * 2. SupabaseStorageProvider when Supabase is enabled and user is logged in
 * 3. Local IndexedDB (Dexie) fallback
 */
export const StorageProviderSelector: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { user } = useAuth();

    if (IS_API_ENABLED && user) {
        return <ApiStorageProvider>{children}</ApiStorageProvider>;
    }

    if (IS_SUPABASE_ENABLED && user) {
        return <SupabaseStorageProvider>{children}</SupabaseStorageProvider>;
    }

    return <StorageProvider>{children}</StorageProvider>;
};
export default StorageProviderSelector;
