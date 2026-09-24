# Fase 6 — Rendimiento, seguridad y resiliencia

## Objetivo

Que la colaboración no degrade la fluidez del canvas, que ninguna operación
evite la autorización y que el sistema se recupere solo de cortes y reinicios.

## Rendimiento del canvas

Punto de partida: el efecto principal de `canvas.tsx` (L659-751) reconstruye
**todos** los nodos cuando cambia `tables`/`areas`/`notes`/… y los compara con
`fast-deep-equal`. Con `TableNode` memoizado por referencia el render es barato,
pero el recálculo es O(n) por cambio, y con ops remotas frecuentes suma.

| Medida | Cuándo |
| --- | --- |
| `applyRemoteOperations` conserva referencias de lo no tocado (Fase 3) | F3 (obligatorio) |
| Agrupar lotes remotos por `requestAnimationFrame` → un `setState` por colección y frame | F3 |
| Aplicar remotos en una transición de React (`startTransition`) para que drag/zoom/tecleo tengan prioridad | F3 |
| **Actualización incremental de nodos**: para ops remotas, `setNodes(nodes => nodes.map(n => affected.has(n.id) ? rebuild(n) : n))` en lugar del efecto global | F6 |
| No mover una tabla que el usuario local está arrastrando: la posición remota se guarda y se aplica al soltar (si no hay cambio local de `x/y`, si lo hay gana el local por Fase 4) | F3 |
| Presencia en contexto aparte (Fase 5) | F5 |
| Relaciones: recalcular solo edges cuyo source/target cambió | F6 |
| Virtualización de campos en `TableNode` (pendiente en `AGENTS.md`) | independiente |

Objetivo medible: con 100 tablas y un lote remoto de 20 ops, el trabajo en el
hilo principal < 16 ms; ninguna tarea larga > 50 ms durante un drag local.

Red: el cliente nunca espera a la red para pintar (actualización optimista ya
existente); todo envío/recepción es asíncrono.

## Seguridad

**Autorización por operación**
- HTTP `/sync`: rol comprobado al inicio del lote (`get_diagram_role`) +
  RLS en cada `INSERT/UPDATE/DELETE` (defensa en profundidad).
- Cada op validada con zod (esquemas existentes + nuevos de sub-entidad);
  `parentId` debe pertenecer al mismo `diagramId` (se consulta con
  `WHERE diagram_id = $1 AND id = $2`; hoy `updateTable` filtra solo por `id` —
  corregirlo en esta fase para todos los `update*` de `diagrams.service.ts`).
- WebSocket: solo mensajes de una lista cerrada (`auth`, `join`, `leave`,
  `presence`, `pong`); cualquier otro → cierre `4400`. Payload validado con zod.
- Revocación: la API publica `access_revoked`/`member_role_changed`; además, el
  servidor WS re-verifica el rol de cada socket cada 60 s (por si se perdió el
  evento) y al renovar el token.

**Acceso a diagramas**
- Ninguna sala se une sin `get_diagram_role() IS NOT NULL`.
- No se difunde nada a sockets que no hayan completado `auth` + `join`.
- `Origin` del upgrade validado contra `CORS_ORIGIN`; `helmet` ya aplica al HTTP.
- Tokens de invitación: solo hash; atados al email (Fase 2).

**Límites y rate limiting**

| Límite | Valor inicial | Dónde |
| --- | --- | --- |
| Ops por lote / tamaño de request | 500 / 2 MB (actual) | `syncRequestSchema`, `express.json` |
| Lotes `/sync` por usuario y diagrama | 20/s ráfaga, 300/min | nuevo `express-rate-limit` con clave `userId:diagramId` y `RedisStore` (patrón de `rateLimit.ts`) |
| Mensaje WS entrante | 16 KB | `maxPayload` de `ws` |
| Mensajes WS entrantes por socket | 20/s (token bucket); exceso → descartar, sostenido 10 s → cierre `4429` | `realtime/` |
| Conexiones WS por usuario | 10 | contador en Redis/memoria |
| Sockets por sala | 50 (más allá: solo lectura sin presencia) | `RoomHub` |
| Tiempo para autenticar | 5 s | `realtime/` |
| Búfer de salida por socket | si `bufferedAmount` > 1 MB → cierre y el cliente hace `resync` | `RoomHub` |
| Búsqueda de usuarios | 30/min | Fase 2 |

## Resiliencia

- **Reconexión WS:** backoff exponencial con jitter (0,5 s, 1 s, 2 s … máx. 30 s),
  reinicio inmediato con el evento `online` del navegador y al volver la pestaña
  a visible. Tras reconectar: `join` con `sinceVersion` (Fase 3).
- **Escrituras:** sin cambios de fondo — el `SyncEngine` ya reintenta con backoff
  (1 s → 16 s, 5 intentos), guarda la cola y el lote en vuelo en `localStorage`,
  y usa `keepalive`. Con `batchId` los reintentos pasan a ser idempotentes.
- **Offline:** el editor sigue siendo editable; la cola crece en memoria y en
  `localStorage` (solo ops, colapsadas por entidad). Al volver: flush de la cola
  → catch-up/resync → rebase (Fase 4). Si la cola supera ~1 MB serializada, se
  avisa al usuario de que conviene reconectar (no se descarta nada).
- **No se guarda el diagrama completo** en `localStorage` ni IndexedDB
  (IndexedDB se retiró del proyecto; mantenerlo así).
- **Reinicio/deploy del servidor:** `SIGTERM` cierra los sockets con código
  `1012` (service restart); los clientes reconectan con backoff (el jitter evita
  la estampida). El log `diagram_ops` cubre el hueco.
- **Redis caído:** el fan-out entre instancias se degrada (cada instancia sigue
  sirviendo a sus propios sockets); se registra el error y `/health` lo refleja.

## Observabilidad

Logs estructurados con `pino` (ya en uso), sin contenido del diagrama:
- `sync.apply`: diagramId, userId, nº ops, aplicadas, rechazadas por motivo, ms.
- `ws.connect/close`: código de cierre, duración, motivo.
- `ws.resync` y `ws.catchup` (tamaño del hueco).

Métricas básicas (contadores en memoria expuestos en `/health?verbose=1`
protegido, o enviados al log cada 60 s): conexiones abiertas, salas activas,
lotes/min, p50/p95 de `sync.apply`, latencia commit→broadcast, rechazos, cierres
por rate limit. Frontend: contar `resync`, rechazos y tiempo de aplicación de
lotes remotos (consola en desarrollo; endpoint de telemetría = futuro).

## Archivos a revisar

- `src/pages/editor-page/canvas/canvas.tsx`, `table-node/table-node.tsx`
- `server/src/middleware/rateLimit.ts`, `server/src/config/redis.ts`
- `server/src/modules/diagrams/diagrams.service.ts` (filtro por `diagram_id` en updates)
- `server/src/server.ts` (shutdown con sockets), `server/src/app.ts` (`/health`)
- `src/context/storage-context/sync-engine.ts`

## Riesgos

- Límites demasiado estrictos rompen importaciones grandes → las importaciones
  usan su propio camino (`diagram_reloaded`, Fase 3) y se excluyen del límite por ráfaga.
- `startTransition` puede retrasar ops remotas bajo carga local intensa; es
  aceptable (prioridad a la interacción local) mientras el retraso sea < 1 s.

## Criterios de aceptación

- [ ] Perfil de Chrome: 100 tablas, drag local continuo mientras llegan 5
      lotes/s remotos → sin tareas largas > 50 ms atribuibles a ops remotas.
- [ ] Un usuario sin acceso no puede unirse a la sala ni con un JWT válido;
      un viewer no puede escribir por WS ni por HTTP (tests).
- [ ] Una op con `parentId` de otro diagrama es rechazada.
- [ ] Superar los límites produce cierres/errores con el código documentado.
- [ ] Reiniciar el servidor con 3 clientes conectados: todos reconectan y
      convergen sin intervención.
- [ ] Ningún log contiene contenido de tablas/campos ni tokens.
