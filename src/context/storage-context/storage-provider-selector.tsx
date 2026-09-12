import React from 'react';
import { ApiStorageProvider } from './api-storage-provider';

export const StorageProviderSelector: React.FC<React.PropsWithChildren> = ({
    children,
}) => <ApiStorageProvider>{children}</ApiStorageProvider>;

export default StorageProviderSelector;
