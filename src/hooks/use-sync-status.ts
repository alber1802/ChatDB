import { useContext } from 'react';
import { syncStatusContext } from '@/context/sync-status-context/sync-status-context';

export const useSyncStatus = () => useContext(syncStatusContext);
