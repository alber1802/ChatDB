import { ApiError, apiFetch } from '@/lib/api-client';

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
const INFLIGHT_KEY_PREFIX = 'chartdb:sync-inflight:';

// Tope duro de espera: por muy continua que sea la actividad del usuario
// (escribir, arrastrar), el debounce no puede posponer el envío más allá de
// este tiempo desde la operación más antigua todavía en cola.
const MAX_WAIT_MS = 4000;

// La spec de Fetch rechaza una petición con `keepalive: true` cuyo cuerpo
// supere 64 KiB, y los navegadores lo aplican. Un lote normal está muy por
// debajo, pero una importación grande (100 tablas con sus campos e índices)
// lo supera de largo: enviarla con keepalive fallaría siempre. Por encima de
// este umbral se envía sin keepalive; ese lote sigue protegido por la copia
// en localStorage (ver persistInFlight/restoreInFlight).
const KEEPALIVE_MAX_BODY_BYTES = 60 * 1024;

function byteLength(value: string): number {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value).length;
    }
    return value.length;
}

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
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private inFlight = false;
    private retryCount = 0;
    private destroyed = false;
    private version: number;
    // Marca de tiempo de la operación más antigua todavía en cola; null cuando
    // la cola está vacía. Sirve para aplicar el tope MAX_WAIT_MS al debounce.
    private oldestQueuedAt: number | null = null;
    private readonly flushDelayMs: number;
    private readonly maxRetries: number;
    private readonly onStatusChange?: SyncEngineOptions['onStatusChange'];
    private readonly onConflict?: SyncEngineOptions['onConflict'];
    private readonly storageKey: string;
    private readonly inFlightKey: string;

    constructor(options: SyncEngineOptions) {
        this.diagramId = options.diagramId;
        this.version = options.initialVersion;
        this.flushDelayMs = options.flushDelayMs ?? 700;
        this.maxRetries = options.maxRetries ?? 5;
        this.onStatusChange = options.onStatusChange;
        this.onConflict = options.onConflict;
        this.storageKey = `${STORAGE_KEY_PREFIX}${this.diagramId}`;
        this.inFlightKey = `${INFLIGHT_KEY_PREFIX}${this.diagramId}`;
        this.restoreQueue();
        this.attachLifecycleListeners();
        // Lo recuperado de localStorage (cola pendiente y/o un lote que se
        // quedó en vuelo al cerrarse la pestaña) debe enviarse solo: si
        // esperásemos a la siguiente edición del usuario podría no llegar
        // nunca. Se programa con el debounce normal, no un flush inmediato,
        // para que varias pestañas restaurando a la vez no golpeen la API.
        if (this.queue.size > 0) this.scheduleFlush();
    }

    enqueue(operation: SyncOperation): void {
        const key = `${operation.entity}:${operation.id}`;
        const existing = this.queue.get(key);
        const merged = existing
            ? collapseOperations([existing, operation])[0]
            : operation;
        this.queue.set(key, merged);
        if (this.oldestQueuedAt === null) this.oldestQueuedAt = Date.now();
        this.persistQueue();
        this.scheduleFlush();
    }

    // Once destroyed, this engine must not report status/conflicts to
    // whatever component/callback it was constructed with — that callback
    // may since have been repurposed for a different diagram (see
    // ApiStorageProvider.ensureEngine). The in-flight send / retry
    // scheduling itself is deliberately NOT gated on `destroyed`: we still
    // want a destroyed engine's last pending write to reach the server (or
    // be re-queued for the next engine to pick up via localStorage), we
    // just stop it from talking to stale callbacks once it's gone.
    private notifyStatus(status: SyncStatus, message?: string): void {
        if (this.destroyed) return;
        this.onStatusChange?.(status, message);
    }

    private notifyConflict(conflicts: SyncConflictInfo[]): void {
        if (this.destroyed) return;
        this.onConflict?.(conflicts);
    }

    private scheduleFlush(): void {
        // Tope de espera máxima: si la operación más antigua ya lleva
        // MAX_WAIT_MS en cola, se envía ya en vez de reiniciar el debounce
        // una vez más. Sin esto, la actividad continua (escribir, arrastrar)
        // puede posponer el flush indefinidamente.
        if (
            this.oldestQueuedAt !== null &&
            Date.now() - this.oldestQueuedAt >= MAX_WAIT_MS
        ) {
            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }
            void this.flushNow();
            return;
        }
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
        // Un flush manual/por ciclo de vida sustituye al reintento pendiente:
        // si no lo cancelásemos, dispararía más tarde y competiría con este
        // intento.
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        if (this.inFlight || this.queue.size === 0) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.notifyStatus('offline');
            return;
        }

        this.inFlight = true;
        this.notifyStatus('saving');

        const batch = [...this.queue.values()];
        this.queue.clear();
        this.oldestQueuedAt = null;
        this.persistQueue();
        // El lote deja de estar en la cola persistida, así que se guarda bajo
        // su propia clave hasta que sepamos que el servidor lo recibió. Si la
        // pestaña muere con la petición en vuelo, el siguiente arranque lo
        // recupera desde ahí (ver restoreQueue).
        this.persistInFlight(batch);

        const body = JSON.stringify({
            baseVersion: this.version,
            operations: batch,
        });

        try {
            const result = await apiFetch<{
                version: number;
                conflicts: SyncConflictInfo[];
            }>(`/diagrams/${this.diagramId}/sync`, {
                method: 'POST',
                // keepalive permite que el navegador termine de enviar la
                // petición aunque la pestaña se esté cerrando (beforeunload).
                // Solo se activa por debajo del límite de 64 KiB que impone la
                // spec (ver KEEPALIVE_MAX_BODY_BYTES).
                keepalive: byteLength(body) <= KEEPALIVE_MAX_BODY_BYTES,
                body,
            });
            this.version = result.version;
            this.retryCount = 0;
            this.clearInFlight();
            this.notifyStatus(this.queue.size > 0 ? 'saving' : 'saved');
            if (result.conflicts.length > 0)
                this.notifyConflict(result.conflicts);
        } catch (err) {
            for (const op of batch) {
                const key = `${op.entity}:${op.id}`;
                const existing = this.queue.get(key);
                const merged = existing
                    ? collapseOperations([op, existing])[0]
                    : op;
                this.queue.set(key, merged);
            }
            if (this.oldestQueuedAt === null) this.oldestQueuedAt = Date.now();
            this.persistQueue();
            // Las operaciones vuelven a estar a salvo en la cola principal.
            this.clearInFlight();
            this.retryCount += 1;
            if (this.retryCount > this.maxRetries) {
                this.notifyStatus(
                    'error',
                    err instanceof Error ? err.message : 'Sync failed'
                );
            } else {
                const backoff = Math.min(
                    1000 * 2 ** (this.retryCount - 1),
                    16000
                );
                // 'offline' solo cuando realmente no hay red (el fetch en sí
                // falló o el navegador se declara sin conexión). Un error HTTP
                // del servidor (500, 409…) llega como ApiError y se comunica
                // como 'error': decirle al usuario "sin conexión" cuando el
                // servidor sí respondió es engañoso.
                const isNetworkFailure =
                    (typeof navigator !== 'undefined' &&
                        navigator.onLine === false) ||
                    !(err instanceof ApiError);
                this.notifyStatus(isNetworkFailure ? 'offline' : 'error');
                this.retryTimer = setTimeout(() => {
                    this.retryTimer = null;
                    void this.flushNow();
                }, backoff);
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
                localStorage.setItem(
                    this.storageKey,
                    JSON.stringify(serializable)
                );
            }
        } catch {
            // localStorage no disponible (modo privado, cuota) — la cola sigue solo en memoria
        }
    }

    private persistInFlight(batch: SyncOperation[]): void {
        try {
            if (batch.length === 0) {
                localStorage.removeItem(this.inFlightKey);
            } else {
                localStorage.setItem(this.inFlightKey, JSON.stringify(batch));
            }
        } catch {
            // localStorage no disponible — el lote sigue solo en memoria
        }
    }

    private clearInFlight(): void {
        try {
            localStorage.removeItem(this.inFlightKey);
        } catch {
            // localStorage no disponible — nada que limpiar
        }
    }

    /**
     * Borra todo rastro persistido de este diagrama (cola pendiente y lote en
     * vuelo). Se usa cuando el diagrama deja de existir: reintentar sus
     * operaciones contra un diagrama borrado solo produce 404s eternos.
     */
    clearPersistedQueue(): void {
        this.queue.clear();
        this.oldestQueuedAt = null;
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.inFlightKey);
        } catch {
            // localStorage no disponible — nada que limpiar
        }
    }

    private restoreQueue(): void {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const stored = JSON.parse(raw) as SyncOperation[];
                for (const op of stored) {
                    this.queue.set(`${op.entity}:${op.id}`, op);
                }
            }
        } catch {
            // almacenamiento corrupto o no disponible — se empieza con la cola vacía
        }
        this.restoreInFlight();
        if (this.queue.size > 0) {
            this.oldestQueuedAt = Date.now();
            this.persistQueue();
        }
    }

    /**
     * Recupera un lote que se quedó en vuelo cuando la sesión anterior murió
     * (pestaña cerrada, crash). No sabemos si llegó al servidor, así que se
     * reencola exactamente igual que en un flush fallido: las operaciones del
     * lote son las más antiguas, por lo que cualquier cosa ya presente en la
     * cola restaurada tiene prioridad al fusionar.
     */
    private restoreInFlight(): void {
        try {
            const raw = localStorage.getItem(this.inFlightKey);
            if (!raw) return;
            const stored = JSON.parse(raw) as SyncOperation[];
            for (const op of stored) {
                const key = `${op.entity}:${op.id}`;
                const existing = this.queue.get(key);
                const merged = existing
                    ? collapseOperations([op, existing])[0]
                    : op;
                this.queue.set(key, merged);
            }
            localStorage.removeItem(this.inFlightKey);
        } catch {
            // almacenamiento corrupto o no disponible — nada que recuperar
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
        document.addEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.addEventListener('online', this.handleOnline);
    }

    destroy(): void {
        this.destroyed = true;
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        if (typeof window === 'undefined') return;
        window.removeEventListener('beforeunload', this.handleFlushTrigger);
        document.removeEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.removeEventListener('online', this.handleOnline);
    }
}
