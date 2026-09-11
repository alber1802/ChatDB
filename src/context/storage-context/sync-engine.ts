import { apiFetch } from '@/lib/api-client';

export type SyncEntity =
    | 'diagram'
    | 'table'
    | 'relationship'
    | 'dependency'
    | 'area'
    | 'customType'
    | 'note';

export type SyncOp = 'create' | 'update' | 'delete';

export interface SyncOperation {
    entity: SyncEntity;
    op: SyncOp;
    id: string;
    patch?: Record<string, unknown>;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

export interface SyncConflictInfo {
    entity: SyncEntity;
    id: string;
}

export interface SyncEngineOptions {
    diagramId: string;
    initialVersion: number;
    flushDelayMs?: number;
    maxRetries?: number;
    onStatusChange?: (status: SyncStatus, message?: string) => void;
    onConflict?: (conflicts: SyncConflictInfo[]) => void;
}

const STORAGE_KEY_PREFIX = 'chartdb:sync-queue:';

export function collapseOperations(
    operations: SyncOperation[]
): SyncOperation[] {
    const byKey = new Map<string, SyncOperation>();
    for (const op of operations) {
        const key = `${op.entity}:${op.id}`;
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, op);
            continue;
        }
        if (op.op === 'delete') {
            byKey.set(key, { entity: op.entity, op: 'delete', id: op.id });
            continue;
        }
        if (prev.op === 'delete') {
            byKey.set(key, op);
            continue;
        }
        byKey.set(key, {
            entity: op.entity,
            op: prev.op === 'create' ? 'create' : 'update',
            id: op.id,
            patch: { ...prev.patch, ...op.patch },
        });
    }
    return [...byKey.values()];
}

export class SyncEngine {
    readonly diagramId: string;
    private queue = new Map<string, SyncOperation>();
    private inFlightSnapshot = new Map<string, SyncOperation>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private inFlight = false;
    private retryCount = 0;
    private version: number;
    private readonly flushDelayMs: number;
    private readonly maxRetries: number;
    private readonly onStatusChange?: SyncEngineOptions['onStatusChange'];
    private readonly onConflict?: SyncEngineOptions['onConflict'];
    private readonly storageKey: string;

    constructor(options: SyncEngineOptions) {
        this.diagramId = options.diagramId;
        this.version = options.initialVersion;
        this.flushDelayMs = options.flushDelayMs ?? 700;
        this.maxRetries = options.maxRetries ?? 5;
        this.onStatusChange = options.onStatusChange;
        this.onConflict = options.onConflict;
        this.storageKey = `${STORAGE_KEY_PREFIX}${this.diagramId}`;
        this.restoreQueue();
        this.attachLifecycleListeners();
    }

    enqueue(operation: SyncOperation): void {
        const key = `${operation.entity}:${operation.id}`;
        const existing = this.queue.get(key);
        const merged = existing
            ? collapseOperations([existing, operation])[0]
            : operation;
        this.queue.set(key, merged);
        this.persistQueue();
        this.scheduleFlush();
    }

    peek(entity: SyncEntity, id: string): Record<string, unknown> | null {
        const key = `${entity}:${id}`;
        const queued = this.queue.get(key) ?? this.inFlightSnapshot.get(key);
        if (!queued || queued.op === 'delete') return null;
        return queued.patch ?? null;
    }

    private scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flushNow();
        }, this.flushDelayMs);
    }

    async flushNow(): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.inFlight || this.queue.size === 0) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.onStatusChange?.('offline');
            return;
        }

        this.inFlight = true;
        this.onStatusChange?.('saving');

        this.inFlightSnapshot = new Map(this.queue);
        const batch = [...this.queue.values()];
        this.queue.clear();
        this.persistQueue();

        try {
            const result = await apiFetch<{
                version: number;
                conflicts: SyncConflictInfo[];
            }>(`/diagrams/${this.diagramId}/sync`, {
                method: 'POST',
                body: JSON.stringify({
                    baseVersion: this.version,
                    operations: batch,
                }),
            });
            this.version = result.version;
            this.retryCount = 0;
            this.inFlightSnapshot.clear();
            this.onStatusChange?.(this.queue.size > 0 ? 'saving' : 'saved');
            if (result.conflicts.length > 0) this.onConflict?.(result.conflicts);
        } catch (err) {
            for (const op of batch) {
                const key = `${op.entity}:${op.id}`;
                const existing = this.queue.get(key);
                const merged = existing
                    ? collapseOperations([op, existing])[0]
                    : op;
                this.queue.set(key, merged);
            }
            this.inFlightSnapshot.clear();
            this.persistQueue();
            this.retryCount += 1;
            if (this.retryCount > this.maxRetries) {
                this.onStatusChange?.(
                    'error',
                    err instanceof Error ? err.message : 'Sync failed'
                );
            } else {
                const backoff = Math.min(1000 * 2 ** (this.retryCount - 1), 16000);
                this.onStatusChange?.('offline');
                setTimeout(() => void this.flushNow(), backoff);
            }
        } finally {
            this.inFlight = false;
            if (this.queue.size > 0 && this.retryCount === 0) {
                this.scheduleFlush();
            }
        }
    }

    private persistQueue(): void {
        try {
            const serializable = [...this.queue.values()];
            if (serializable.length === 0) {
                localStorage.removeItem(this.storageKey);
            } else {
                localStorage.setItem(this.storageKey, JSON.stringify(serializable));
            }
        } catch {
            // localStorage no disponible (modo privado, cuota) — la cola sigue solo en memoria
        }
    }

    private restoreQueue(): void {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const stored = JSON.parse(raw) as SyncOperation[];
            for (const op of stored) {
                this.queue.set(`${op.entity}:${op.id}`, op);
            }
        } catch {
            // almacenamiento corrupto o no disponible — se empieza con la cola vacía
        }
    }

    private handleFlushTrigger = (): void => {
        void this.flushNow();
    };

    private handleVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') void this.flushNow();
    };

    private handleOnline = (): void => {
        this.retryCount = 0;
        void this.flushNow();
    };

    private attachLifecycleListeners(): void {
        if (typeof window === 'undefined') return;
        window.addEventListener('beforeunload', this.handleFlushTrigger);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('online', this.handleOnline);
    }

    destroy(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        if (typeof window === 'undefined') return;
        window.removeEventListener('beforeunload', this.handleFlushTrigger);
        document.removeEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.removeEventListener('online', this.handleOnline);
    }
}
