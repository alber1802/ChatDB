import { createContext, useContext } from 'react';
import type { SyncOperation } from '@/context/storage-context/sync-engine';
import type {
    RealtimeStatus,
    RemoteBatchMeta,
} from '@/lib/realtime/realtime-client';
import type { DiagramAccessRole } from '@/lib/domain/diagram-access';

// Eventos de colaboración en vivo para el diagrama abierto. Contexto aparte
// del storage para que un cambio de estado de conexión no re-renderice a
// todos los consumidores del storage.

export interface RealtimeListener {
    onBatch?: (operations: SyncOperation[], meta: RemoteBatchMeta) => void;
    /** El servidor no puede cubrir el hueco: hay que recargar el diagrama. */
    onResync?: () => void;
    onAccess?: (role: DiagramAccessRole | null) => void;
    onDeleted?: () => void;
}

export interface RealtimeContext {
    status: RealtimeStatus | 'disabled';
    /**
     * Escucha los eventos en vivo de un diagrama. La conexión WebSocket se abre
     * con el primer suscriptor y se cierra con el último (el Dashboard no abre
     * ninguna).
     */
    subscribe: (diagramId: string, listener: RealtimeListener) => () => void;
}

export const realtimeContext = createContext<RealtimeContext>({
    status: 'disabled',
    subscribe: () => () => {},
});

export const useRealtime = () => useContext(realtimeContext);
