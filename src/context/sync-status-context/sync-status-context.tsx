import { createContext } from 'react';
import type { SyncStatus } from '@/context/storage-context/sync-engine';

export interface SyncStatusContextValue {
    status: SyncStatus;
    errorMessage?: string;
    retry: () => void;
}

export const syncStatusContext = createContext<SyncStatusContextValue>({
    status: 'idle',
    retry: () => {},
});
