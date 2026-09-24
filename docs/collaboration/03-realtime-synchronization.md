# Fase 3 — Sincronización en tiempo real

## Objetivo

Que cada lote confirmado por el servidor llegue a los demás clientes del mismo
diagrama en < 300 ms, aplicado de forma incremental, sin recargar el diagrama y
sin tocar el camino de escritura que ya funciona.

## Evaluación del transporte

| Opción | Veredicto | Motivo |
| --- | --- | --- |
| **WebSocket (`ws`) en el servidor Express** | ✅ Elegida | Bidireccional (presencia + ops), una conexión por pestaña, soportado por Heroku, sin dependencias pesadas; comparte proceso, auth (JWKS) y pool con la API |
| SSE + POST | Viable, descartada | Unidireccional: la presencia/heartbeat necesitaría POSTs aparte; límite de 6 conexiones HTTP/1.1 por origen con varias pestañas |
| Supabase Realtime (broadcast / postgres_changes) | ❌ | El frontend ya no habla con Supabase para datos; la difusión saltaría la validación del servidor; `postgres_changes` emite por fila (N eventos por lote, sin `opId`/orden de lote) |
| Socket.IO | ❌ | Añade protocolo y fallback de long-polling que no se necesitan |
| Postgres `LISTEN/NOTIFY` para fan-out | ❌ | `DATABASE_URL` usa el pooler en modo transacción (6543): no soporta `LISTEN` |
| **Redis pub/sub** para fan-out entre instancias | ✅ | `ioredis` ya está; si `REDIS_URL` no está, `EventEmitter` en memoria (una sola instancia), igual que el resto de usos de Redis |

## Principio: HTTP escribe, WebSocket difunde

```
Cliente A                         Servidor                                  Cliente B
enqueue(op) ─debounce─▶ POST /sync {batchId, baseVersion, sessionId, ops[]}
                                  BEGIN; FOR UPDATE diagrams; autorizar rol
                                  aplicar ops (orden de llegada); version+1
                                  INSERT diagram_ops(version, batch_id, ops…)
                                  COMMIT
                                  publish diagram:{id} ─ Redis ─▶ RoomHub ─WS─▶ {type:'ops', version, ops, by}
◀── 200 {version, applied, rejected}                                         applyRemoteOperations()
```

- **Por qué no escribir por WS:** el `SyncEngine` ya resuelve cola, reintentos,
  backoff, `keepalive` al cerrar la pestaña y espejo en `localStorage`. Duplicar
  eso sobre WS añade riesgo sin ganar latencia apreciable (una request HTTP
  keep-alive a la misma región cuesta ~20–60 ms). Mover escrituras al socket queda
  como optimización futura, con el mismo formato de lote.
- **Publicar tras `COMMIT`**, nunca dentro de la transacción: nadie recibe ops
  que luego se revierten.

## Contrato de operaciones

Evolución compatible del `SyncOperation` actual:

```ts
interface SyncOperation {
  opId: string;                  // uuid v4 generado en enqueue(); nuevo
  entity: 'diagram' | 'table' | 'field' | 'index' | 'checkConstraint'
        | 'relationship' | 'dependency' | 'area' | 'customType' | 'note';
  op: 'create' | 'update' | 'delete';
  id: string;
  parentId?: string;             // tableId para field/index/checkConstraint; nuevo
  patch?: Record<string, unknown>; // SOLO propiedades cambiadas en update
}
interface SyncRequest  { batchId: string; baseVersion: number; sessionId: string; operations: SyncOperation[] }
interface SyncResponse { version: number; applied: string[]; rejected: { opId: string; reason: RejectReason }[] }
interface RemoteBatch  { type: 'ops'; version: number; batchId: string; sessionId: string;
                         userId: string; operations: SyncOperation[] }   // solo ops aplicadas
```

- `field`/`index`/`checkConstraint` son operaciones sobre elementos de los arrays
  JSONB de `db_tables` (ver Fase 4). La clave de colapso en la cola pasa a
  `entity:parentId:id`.
- `applied`/`rejected` sustituyen a `conflicts` (el campo se mantiene vacío un
  tiempo para compatibilidad con clientes viejos en caché).
- Límites: 500 ops por lote (actual), 2 MB por request (actual), 256 KB por
  mensaje WS salvo el snapshot de recuperación.

## Secuencia, idempotencia y log corto

- **Secuencia:** `diagrams.version` ya es un contador por diagrama incrementado
  una vez por lote bajo `FOR UPDATE`. Se usa tal cual como número de secuencia
  total del diagrama; no hace falta otro contador.
- **Idempotencia (`batchId`):** hoy un reintento cuyo ack se perdió **se vuelve
  a aplicar** (el `sessionId` solo evita el falso conflicto). Nueva tabla:

```sql
CREATE TABLE diagram_ops (
  diagram_id  text   NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  version     integer NOT NULL,
  batch_id    uuid   NOT NULL,
  session_id  text,
  user_id     uuid   NOT NULL,
  operations  jsonb  NOT NULL,   -- solo las aplicadas
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (diagram_id, version),
  UNIQUE (diagram_id, batch_id)
);
```
  Al recibir un lote, si `batch_id` ya existe se devuelve la respuesta guardada
  sin reaplicar. RLS: SELECT/INSERT con `can_view`/`can_edit`.
- **Retención:** últimas 1000 versiones o 24 h por diagrama (borrado en la misma
  transacción cada 100 versiones). No es event sourcing: el estado vive en las
  tablas; el log solo cubre huecos de reconexión e idempotencia.
- `last_sync_session_id` queda obsoleto (lo sustituye `batch_id`); se retira
  cuando no queden clientes antiguos.

## Servidor WebSocket

Nuevo módulo `server/src/modules/realtime/`:

- `ws.ts` — `WebSocketServer({ noServer: true })` enganchado en
  `server.on('upgrade')` de `server.ts` en la ruta `/realtime`. Verifica `Origin`
  contra `CORS_ORIGIN` antes de aceptar el upgrade.
- **Autenticación:** el primer mensaje debe ser `{type:'auth', token}` en < 5 s
  (el token no va en la URL para no quedar en logs de proxy). Se valida con el
  mismo `jwtVerify` + JWKS de `middleware/auth.ts` (extraer a una función
  reutilizable). Antes de que expire, el cliente reenvía `auth` con el token
  refrescado por Supabase; si expira sin renovar → cierre `4001`.
- **Salas:** `{type:'join', diagramId, sinceVersion}` → `get_diagram_role()` vía
  `withUserContext`; `NULL` → cierre `4003`. Una conexión por pestaña, se puede
  estar en una sola sala a la vez (el editor abre un diagrama).
- `RoomHub` — `Map<diagramId, Set<Socket>>` local + suscripción Redis
  `diagram:{id}` solo mientras haya sockets locales en esa sala.
- **Eco:** el emisor recibe también su lote (útil como confirmación en vivo) y lo
  ignora por `sessionId`.
- **Eventos de control** publicados por la API REST en el mismo canal:
  `member_role_changed`, `access_revoked`, `diagram_deleted`, `diagram_reloaded`
  (importaciones masivas).
- Heartbeat: `ping` del servidor cada 25 s (Heroku corta a los 55 s de
  inactividad); sin `pong` en 2 intervalos → `terminate()`.

## Recuperación al (re)conectar

1. El cliente envía `join` con `sinceVersion` = última versión aplicada.
2. Si `sinceVersion >= version` actual → `{type:'joined', version}`.
3. Si el hueco está en `diagram_ops` → se reenvían los lotes en orden.
4. Si no (hueco > retención o `sinceVersion` desconocido) → `{type:'resync'}`: el
   cliente hace `GET /diagrams/:id` completo y lo aplica con reemplazo selectivo
   (ver abajo), **después** de volcar su cola pendiente.

## Integración en el cliente

**`RealtimeClient`** (nuevo, `src/context/realtime-context/`): conexión, auth,
reconexión con backoff exponencial + jitter (0,5 s → 30 s), estado
`connecting | live | reconnecting | offline`. Se crea en `ApiStorageProvider`
junto al `SyncEngine` del diagrama activo (`ensureEngine`).

**Cambios en `SyncEngine`:**
- `opId` por operación y `batchId` estable por lote (se persiste con el lote en
  vuelo, así el reintento tras recarga es idempotente).
- `onRemoteBatch(batch)`: aplica en orden de `version`; si llega `version > last+1`
  guarda en búfer y pide catch-up; si `<= last` lo descarta (duplicado).
- Tras el ack propio, `version = max(version, ack.version)`.
- **Debounce adaptativo:** con 2+ miembros conectados, `flushDelayMs` 150 ms y
  tope 600 ms (hoy 700 ms / 4 s). Solo, se mantiene el valor actual.
- Arrastres: se envía `{x, y}` al soltar (comportamiento actual tras el fix de
  drag). Posición en vivo durante el arrastre = mejora futura (mensaje efímero WS).

**`applyRemoteOperations(ops)`** nuevo en `chartdb-provider.tsx` y expuesto en el
contexto:
- Usa **solo los setters** (`setTables`, `setRelationships`, …): sin `db.*`, sin
  `addUndoAction`, sin re-encolar (evita el eco al servidor). Funciona también en
  `readonly` (viewer).
- Reemplaza **solo los objetos afectados** y conserva la referencia del resto:
  `TableNode` está memoizado por referencia de `data.table`
  (`table-node.tsx:76-97`), así que solo re-renderizan las tablas tocadas.
- Aplica ops de `field`/`index` fusionando en el array de la tabla por id.
- Agrupa los lotes recibidos en el mismo frame (`requestAnimationFrame`) en un
  único `setState` por colección.
- Emite los eventos del bus existente (`events.emit`) que otros componentes usan
  para refrescar (p. ej. `remove_tables`), marcados `origin: 'remote'`.
- Ver Fase 4 para la regla de propiedades con cambios locales pendientes y
  Fase 6 para el caso de la tabla que el usuario está arrastrando.

## Archivos a revisar

- `server/src/server.ts` (upgrade), `server/src/middleware/auth.ts` (extraer verificación)
- `server/src/modules/sync/sync.service.ts`, `server/src/lib/schemas.ts` (`syncRequestSchema`)
- `server/src/config/redis.ts` (segunda conexión para `subscribe`)
- `src/context/storage-context/sync-engine.ts`, `api-storage-provider.tsx`
- `src/context/chartdb-context/chartdb-provider.tsx`, `chartdb-context.tsx`
- `src/pages/editor-page/canvas/canvas.tsx` (efecto de nodos L659-751)

## Riesgos

- **Eco/bucle:** aplicar remoto con mutadores re-encolaría la op → por eso setters.
- Import masivo (100+ tablas) produce un lote enorme → se difunde `diagram_reloaded`
  y los demás hacen `GET` completo en vez de recibir 2 MB por WS.
- Un cliente viejo (sin `batchId`) sigue funcionando: el servidor genera un
  `batchId` y no hay idempotencia para él.
- Varias instancias sin Redis → los usuarios en instancias distintas no se ven.
  Documentar `REDIS_URL` como obligatorio si hay más de un dyno.

## Criterios de aceptación

- [ ] Dos navegadores: crear/editar/borrar tabla, columna, relación, área y nota
      en A aparece en B en p95 < 500 ms sin recarga.
- [ ] Reintentar un lote con el mismo `batchId` no lo aplica dos veces (test).
- [ ] Cortar la red de B 60 s mientras A edita: al volver, B converge (catch-up
      desde `diagram_ops`), y con un hueco mayor que la retención hace `resync`.
- [ ] Las ops remotas no aparecen en el undo de B ni se reenvían al servidor.
- [ ] Con dos instancias del API y Redis, usuarios en instancias distintas se ven.
- [ ] Un viewer recibe ops en vivo y no puede enviar ninguna.
