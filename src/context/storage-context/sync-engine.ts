import { ApiError, apiFetch } from '@/lib/api-client';

export type SyncEntity =
    | 'diagram'
    | 'table'
    // Elementos de los arrays de una tabla (Fase 4-a, ver table-diff.ts)
    | 'field'
    | 'index'
    | 'checkConstraint'
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
    /** tableId para field/index/checkConstraint. */
    parentId?: string;
    /** Solo en create de sub-entidad: insertar tras este id (null = al principio). */
    afterId?: string | null;
    patch?: Record<string, unknown>;
}

interface Batch {
    /** Estable entre reintentos: el servidor no reaplica un batchId ya visto. */
    batchId: string;
    operations: SyncOperation[];
}

const opKey = (op: SyncOperation) =>
    op.parentId
        ? `${op.entity}:${op.parentId}:${op.id}`
        : `${op.entity}:${op.id}`;

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
const SESSION_KEY_PREFIX = 'chartdb:sync-session:';

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
        const key = opKey(op);
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, op);
            continue;
        }
        const base = {
            entity: op.entity,
            id: op.id,
            ...(op.parentId ? { parentId: op.parentId } : {}),
        };
        if (op.op === 'delete') {
            byKey.set(key, { ...base, op: 'delete' });
            continue;
        }
        if (prev.op === 'delete') {
            byKey.set(key, op);
            continue;
        }
        const afterId =
            prev.op === 'create' && prev.afterId !== undefined
                ? { afterId: prev.afterId }
                : {};
        byKey.set(key, {
            ...base,
            op: prev.op === 'create' ? 'create' : 'update',
            ...afterId,
            patch: { ...prev.patch, ...op.patch },
        });
    }
    return [...byKey.values()];
}

export class SyncEngine {
    readonly diagramId: string;
    private queue = new Map<string, SyncOperation>();
    // Lote que falló (o que quedó en vuelo al cerrarse la pestaña) y que se
    // reenvía TAL CUAL, con su batchId, antes de cualquier otra cosa. No se
    // fusiona con la cola: si el primer intento sí llegó al servidor, este
    // responde con el resultado guardado para ese batchId, y cualquier op
    // añadida al lote se perdería.
    private retryBatch: Batch | null = null;
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private inFlight = false;
    // Se resuelve cuando termina el envío en curso (con éxito o error). Permite
    // que quien llame a flushNow() durante un envío espere a que ese envío
    // acabe en vez de volver de inmediato dejando escrituras sin confirmar.
    private inFlightDone: Promise<void> | null = null;
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
    private readonly sessionId: string;
    private persistQueueTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(options: SyncEngineOptions) {
        this.diagramId = options.diagramId;
        this.version = options.initialVersion;
        this.flushDelayMs = options.flushDelayMs ?? 700;
        this.maxRetries = options.maxRetries ?? 5;
        this.onStatusChange = options.onStatusChange;
        this.onConflict = options.onConflict;
        this.storageKey = `${STORAGE_KEY_PREFIX}${this.diagramId}`;
        this.inFlightKey = `${INFLIGHT_KEY_PREFIX}${this.diagramId}`;
        this.sessionId = this.resolveSessionId();
        this.restoreQueue();
        this.attachLifecycleListeners();
        // Lo recuperado de localStorage (cola pendiente y/o un lote que se
        // quedó en vuelo al cerrarse la pestaña) debe enviarse solo: si
        // esperásemos a la siguiente edición del usuario podría no llegar
        // nunca. Se programa con el debounce normal, no un flush inmediato,
        // para que varias pestañas restaurando a la vez no golpeen la API.
        if (this.queue.size > 0 || this.retryBatch) this.scheduleFlush();
    }

    // Identifica esta pestaña/sesión ante el backend (ver last_sync_session_id
    // en sync.service.ts) para que un reintento cuyo ack se perdió no se
    // reporte como "otra sesión sobrescribió tus cambios" cuando en realidad
    // fue esta misma sesión. Vive en sessionStorage (no localStorage): debe
    // sobrevivir a un reload de ESTA pestaña pero seguir siendo distinto por
    // pestaña, para que un conflicto real entre dos pestañas del mismo
    // navegador se siga reportando.
    private resolveSessionId(): string {
        const key = `${SESSION_KEY_PREFIX}${this.diagramId}`;
        try {
            const existing = sessionStorage.getItem(key);
            if (existing) return existing;
            const id = crypto.randomUUID();
            sessionStorage.setItem(key, id);
            return id;
        } catch {
            return crypto.randomUUID();
        }
    }

    /** Última versión conocida del diagrama (ack propio o lote remoto). */
    get currentVersion(): number {
        return this.version;
    }

    /** Identifica a esta pestaña; el cliente realtime descarta sus propios lotes. */
    get currentSessionId(): string {
        return this.sessionId;
    }

    /**
     * Otra sesión avanzó la versión (lote recibido por WebSocket). Sin esto el
     * siguiente envío llevaría un baseVersion viejo y el servidor lo marcaría
     * como conflicto aunque no lo sea.
     */
    observeVersion(version: number): void {
        this.version = Math.max(this.version, version);
    }

    enqueue(operation: SyncOperation): void {
        const key = opKey(operation);
        const existing = this.queue.get(key);
        const merged = existing
            ? collapseOperations([existing, operation])[0]
            : operation;
        this.queue.set(key, merged);
        if (this.oldestQueuedAt === null) this.oldestQueuedAt = Date.now();
        this.schedulePersistQueue();
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
        if (this.inFlight) {
            // Los llamantes de flushNow() (lecturas de una sola entidad,
            // borrados masivos) necesitan que TODO lo pendiente haya llegado al
            // servidor cuando esta promesa resuelva. Volver aquí sin esperar
            // dejaría el envío en curso sin confirmar y reabriría, en una
            // ventana más estrecha, la misma carrera de lectura obsoleta.
            await this.inFlightDone;
            return this.flushNow();
        }
        if (this.queue.size === 0 && !this.retryBatch) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.notifyStatus('offline');
            return;
        }

        this.inFlight = true;
        let releaseInFlight: () => void = () => {};
        this.inFlightDone = new Promise<void>((resolve) => {
            releaseInFlight = resolve;
        });
        this.notifyStatus('saving');

        let batch: Batch;
        if (this.retryBatch) {
            batch = this.retryBatch;
        } else {
            batch = {
                batchId: crypto.randomUUID(),
                operations: [...this.queue.values()],
            };
            this.queue.clear();
            this.oldestQueuedAt = null;
            this.persistQueue();
        }
        // El lote deja de estar en la cola persistida, así que se guarda bajo
        // su propia clave hasta que sepamos que el servidor lo recibió. Si la
        // pestaña muere con la petición en vuelo, el siguiente arranque lo
        // recupera desde ahí, con el mismo batchId (ver restoreInFlight).
        this.persistInFlight(batch);

        const body = JSON.stringify({
            baseVersion: this.version,
            sessionId: this.sessionId,
            batchId: batch.batchId,
            operations: batch.operations,
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
            this.version = Math.max(this.version, result.version);
            this.retryCount = 0;
            this.retryBatch = null;
            this.clearInFlight();
            this.notifyStatus(this.queue.size > 0 ? 'saving' : 'saved');
            if (result.conflicts.length > 0)
                this.notifyConflict(result.conflicts);
        } catch (err) {
            // El lote se reintenta intacto (mismo batchId); sigue persistido
            // bajo la clave in-flight hasta que el servidor lo confirme.
            this.retryBatch = batch;
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
            this.inFlightDone = null;
            releaseInFlight();
            if (this.queue.size > 0 && this.retryCount === 0) {
                this.scheduleFlush();
            }
        }
    }

    // `enqueue()` can fire on every animation frame (e.g. a table resize
    // drags through many intermediate dimension changes) — writing the whole
    // queue to localStorage synchronously on each call blocks the main
    // thread proportionally to queue size for no benefit, since the mirror
    // only needs to be reasonably fresh for crash recovery, not exact.
    private schedulePersistQueue(): void {
        if (this.persistQueueTimer) return;
        this.persistQueueTimer = setTimeout(() => {
            this.persistQueueTimer = null;
            this.persistQueue();
        }, 150);
    }

    private persistQueue(): void {
        if (this.persistQueueTimer) {
            clearTimeout(this.persistQueueTimer);
            this.persistQueueTimer = null;
        }
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

    private persistInFlight(batch: Batch): void {
        try {
            if (batch.operations.length === 0) {
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
        this.retryBatch = null;
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
                    this.queue.set(opKey(op), op);
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
     * reenvía intacto con su batchId: si ya se aplicó, el servidor devuelve
     * la respuesta guardada. La cola restaurada (más nueva) va después.
     *
     * Formato antiguo (array sin batchId, versiones previas del cliente): no
     * hay idempotencia posible, así que se fusiona bajo la cola como antes.
     */
    private restoreInFlight(): void {
        try {
            const raw = localStorage.getItem(this.inFlightKey);
            if (!raw) return;
            const stored = JSON.parse(raw) as Batch | SyncOperation[];
            if (!Array.isArray(stored)) {
                if (stored.operations?.length) this.retryBatch = stored;
                return;
            }
            for (const op of stored) {
                const key = opKey(op);
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
        // Flush rather than drop: a pending throttled write must land before
        // this engine goes away, or the mirror in localStorage would miss
        // whatever was enqueued in the last 150ms.
        if (this.persistQueueTimer) this.persistQueue();
        if (typeof window === 'undefined') return;
        window.removeEventListener('beforeunload', this.handleFlushTrigger);
        document.removeEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.removeEventListener('online', this.handleOnline);
    }
}
