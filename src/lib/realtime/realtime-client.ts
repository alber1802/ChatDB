import type { SyncOperation } from '@/context/storage-context/sync-engine';
import type { DiagramAccessRole } from '@/lib/domain/diagram-access';

// Cliente WebSocket de colaboración
// (docs/collaboration/03-realtime-synchronization.md). Solo RECIBE: las
// escrituras siguen saliendo por el SyncEngine (POST /sync). Aquí se
// garantiza que los lotes remotos se aplican una sola vez y en orden de
// versión, y se reconecta solo con backoff.

export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface SocketLike {
    readyState: number;
    send(data: string): void;
    close(code?: number): void;
    onopen: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onclose: ((event: { code: number }) => void) | null;
    onerror: (() => void) | null;
}

export interface RemoteBatchMeta {
    version: number;
    userId: string;
    batchId: string;
}

export interface RealtimeClientOptions {
    url: string;
    diagramId: string;
    initialVersion: number;
    /** sessionId del SyncEngine de esta pestaña: sus propios lotes no se reaplican. */
    sessionId: string;
    getToken: () => Promise<string | null>;
    onBatch: (operations: SyncOperation[], meta: RemoteBatchMeta) => void;
    onResync: () => void;
    onAccess: (role: DiagramAccessRole | null) => void;
    onDeleted: () => void;
    onStatus?: (status: RealtimeStatus) => void;
    createSocket?: (url: string) => SocketLike;
    random?: () => number;
}

interface IncomingBatch extends RemoteBatchMeta {
    type: 'ops';
    sessionId: string | null;
    operations: SyncOperation[];
}

const OPEN = 1;
const GAP_TIMEOUT_MS = 2000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 30_000;
// Códigos definitivos: no tiene sentido reintentar.
const FINAL_CLOSE_CODES = new Set([4003, 4004]);

export class RealtimeClient {
    private socket: SocketLike | null = null;
    private lastVersion: number;
    private pending = new Map<number, IncomingBatch>();
    private gapTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private attempt = 0;
    private destroyed = false;
    private stopped = false;
    private status: RealtimeStatus | null = null;

    constructor(private readonly options: RealtimeClientOptions) {
        this.lastVersion = options.initialVersion;
    }

    /** Última versión aplicada (propia o remota). */
    get version(): number {
        return this.lastVersion;
    }

    connect(): void {
        if (this.destroyed || this.stopped) return;
        this.clearReconnect();
        this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
        const socket = (this.options.createSocket ?? defaultSocket)(
            this.options.url
        );
        this.socket = socket;
        socket.onopen = () => void this.authenticate(socket);
        socket.onmessage = (event) => this.onMessage(socket, event.data);
        socket.onerror = () => {
            // el cierre llega después por onclose; ahí se decide reconectar
        };
        socket.onclose = (event) => this.onClose(socket, event.code);
    }

    /** Tras recargar el diagrama completo (resync), se ordena desde su versión. */
    resetVersion(version: number): void {
        this.lastVersion = version;
        this.pending.clear();
        this.clearGapTimer();
    }

    /** Reintento inmediato (evento `online`, pestaña visible otra vez). */
    reconnectNow(): void {
        if (this.destroyed || this.stopped) return;
        if (this.socket && this.socket.readyState === OPEN) return;
        this.attempt = Math.max(this.attempt, 1);
        this.connect();
    }

    destroy(): void {
        this.destroyed = true;
        this.clearReconnect();
        this.clearGapTimer();
        const socket = this.socket;
        this.socket = null;
        if (socket) {
            socket.onclose = null;
            socket.close(1000);
        }
    }

    private async authenticate(socket: SocketLike) {
        const token = await this.options.getToken();
        if (socket !== this.socket || this.destroyed) return;
        if (!token) {
            socket.close(4001);
            return;
        }
        socket.send(JSON.stringify({ type: 'auth', token }));
    }

    private join(socket: SocketLike) {
        socket.send(
            JSON.stringify({
                type: 'join',
                diagramId: this.options.diagramId,
                sinceVersion: this.lastVersion,
            })
        );
    }

    private onMessage(socket: SocketLike, raw: string) {
        if (socket !== this.socket) return;
        let message: { type?: string } & Record<string, unknown>;
        try {
            message = JSON.parse(raw);
        } catch {
            return;
        }
        switch (message.type) {
            case 'authed':
                this.join(socket);
                return;
            case 'joined':
                this.attempt = 0;
                this.setStatus('live');
                return;
            case 'ops':
                this.receiveBatch(message as unknown as IncomingBatch);
                return;
            case 'resync':
                this.options.onResync();
                return;
            case 'access':
                this.options.onAccess(
                    (message.role as DiagramAccessRole | null) ?? null
                );
                if (!message.role) this.stopped = true;
                return;
            case 'diagram_deleted':
                this.stopped = true;
                this.options.onDeleted();
                return;
        }
    }

    private receiveBatch(batch: IncomingBatch) {
        if (batch.version <= this.lastVersion) return; // duplicado
        this.pending.set(batch.version, batch);
        let next = this.pending.get(this.lastVersion + 1);
        while (next) {
            this.pending.delete(next.version);
            this.lastVersion = next.version;
            if (next.sessionId !== this.options.sessionId) {
                this.options.onBatch(next.operations, {
                    version: next.version,
                    userId: next.userId,
                    batchId: next.batchId,
                });
            }
            next = this.pending.get(this.lastVersion + 1);
        }
        if (this.pending.size === 0) {
            this.clearGapTimer();
        } else if (!this.gapTimer) {
            // Falta un lote intermedio: si no llega pronto, se pide de nuevo
            // desde la última versión aplicada (catch-up o resync del servidor).
            this.gapTimer = setTimeout(() => {
                this.gapTimer = null;
                if (this.socket && this.socket.readyState === OPEN) {
                    this.join(this.socket);
                }
            }, GAP_TIMEOUT_MS);
        }
    }

    private onClose(socket: SocketLike, code: number) {
        if (socket !== this.socket) return;
        this.socket = null;
        this.clearGapTimer();
        if (this.destroyed) return;
        if (this.stopped || FINAL_CLOSE_CODES.has(code)) {
            this.stopped = true;
            this.setStatus('offline');
            return;
        }
        this.attempt += 1;
        this.setStatus(
            typeof navigator !== 'undefined' && navigator.onLine === false
                ? 'offline'
                : 'reconnecting'
        );
        const exp = Math.min(
            BACKOFF_BASE_MS * 2 ** (this.attempt - 1),
            BACKOFF_MAX_MS
        );
        // Jitter ±50 % para que muchos clientes no reconecten a la vez tras
        // un reinicio del servidor.
        const jitter = 0.5 + (this.options.random ?? Math.random)();
        this.reconnectTimer = setTimeout(
            () => this.connect(),
            Math.round(exp * jitter)
        );
    }

    private setStatus(status: RealtimeStatus) {
        if (status === this.status) return;
        this.status = status;
        this.options.onStatus?.(status);
    }

    private clearReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    private clearGapTimer() {
        if (this.gapTimer) clearTimeout(this.gapTimer);
        this.gapTimer = null;
    }
}

function defaultSocket(url: string): SocketLike {
    return new WebSocket(url) as unknown as SocketLike;
}

/** ws(s)://<api>/realtime a partir de VITE_API_URL. */
export function realtimeUrl(apiUrl: string): string {
    const url = new URL(apiUrl, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/realtime`;
    url.search = '';
    return url.toString();
}
