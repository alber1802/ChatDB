# Colaboración en tiempo real — Plan maestro

Fecha: 2026-09-23 · Rama: `develop` · Estado: **diseño, sin implementar**

## Objetivo

Que un diagrama pueda compartirse con dos o más usuarios que lo **ven y editan a
la vez**, con cambios visibles en menos de ~300 ms, sin bloquear el canvas
(drag, zoom, pan, edición local) y sin perder ni pisar datos.

## Punto de partida (lo que YA existe)

| Pieza | Estado actual | Dónde |
| --- | --- | --- |
| Compartir (tabla) | `diagram_shares(diagram_id, owner_id, shared_with, role)` con `UNIQUE(diagram_id, shared_with)`; `role` solo admite `'editor'` | Supabase |
| Autorización RLS | `can_view_diagram()` / `can_edit_diagram()` (SECURITY DEFINER) ya usadas por todas las tablas hijas; `diagrams` UPDATE permite a editores | Supabase |
| API de shares | `GET/POST/DELETE /diagrams/:id/shares` (POST exige `uuid`, sin invitaciones) — **nadie la usa en el frontend** | `server/src/modules/shares/shares.routes.ts` |
| Buscar usuario | `get_user_by_email(text)` (coincidencia exacta) | Supabase |
| Escrituras | `SyncEngine` → `POST /diagrams/:id/sync` (lote, transacción única, `version` global, `sessionId`) | `src/context/storage-context/sync-engine.ts`, `server/src/modules/sync/sync.service.ts` |
| Solo lectura | `ChartDBProvider readonly` ya bloquea edición en ~46 archivos | `src/context/chartdb-context/chartdb-provider.tsx` |
| Redis | opcional (`ioredis`), hoy solo rate-limit/lockout | `server/src/config/redis.ts` |
| Tiempo real | **nada** (ni WebSocket, ni SSE, ni Supabase Realtime) | — |
| UI de compartir / presencia / conflictos | **nada** (`onConflict` solo hace `console.warn`) | — |

## Arquitectura resumida

```
 Navegador A                         chartdb-api (Express)                 Postgres
 ┌──────────────┐  POST /sync (lote, ┌──────────────────────────┐  tx     ┌──────────────┐
 │ SyncEngine   │──batchId, opIds)──▶│ syncService.apply        │────────▶│ tablas       │
 │ (escrituras) │◀── ack {version} ──│  valida + ordena + aplica│         │ diagram_ops  │
 └──────────────┘                    │  publica lote confirmado │         │ (log corto)  │
 ┌──────────────┐   WebSocket        │          │               │         └──────────────┘
 │ Realtime     │◀══ ops remotas ════│ RoomHub (sala/diagrama)  │◀─ Redis pub/sub (multi-instancia)
 │ client       │══ presencia ══════▶│ presencia, heartbeat     │
 └──────────────┘                    └──────────────────────────┘
        │ applyRemoteOperations() — solo setters, sin storage ni historial
        ▼
   chartdb-provider → canvas (TableNode memo por referencia)
```

Decisiones clave (detalle en cada documento):

1. **Las escrituras siguen por `POST /diagrams/:id/sync`** (ya tiene reintentos,
   `keepalive`, cola en `localStorage`). El WebSocket solo **difunde** lotes ya
   confirmados y lleva presencia. Así el servidor sigue siendo la única autoridad
   y no se duplica el camino de escritura.
2. **`diagrams.version` pasa a ser la secuencia** de operaciones del diagrama:
   cada lote confirmado = +1. Un log corto `diagram_ops` permite recuperar
   huecos al reconectar. No es event sourcing: el estado sigue en las tablas.
3. **Operaciones por propiedad y por sub-entidad** (`field`, `index`,
   `checkConstraint`) en vez de reescribir los arrays JSONB completos de
   `db_tables`. Es el cambio que hace posible que dos personas editen la misma
   tabla sin pisarse.
4. **Last-writer-wins por propiedad según orden del servidor**. Sin CRDT/OT: el
   modelo es estructurado (entidades con id), no texto libre.
5. **Transporte: WebSocket (`ws`) sobre el mismo servidor HTTP** + Redis pub/sub
   para escalar a varias instancias (Heroku dynos). No `LISTEN/NOTIFY` porque el
   pooler de Supabase está en modo transacción.

## Documentos

| # | Documento | Contenido |
| --- | --- | --- |
| 1 | [01-architecture.md](01-architecture.md) | Modelo de acceso, roles, entidades, reglas de autorización |
| 2 | [02-sharing-and-permissions.md](02-sharing-and-permissions.md) | Modal de compartir, búsqueda, invitaciones, gestión de miembros |
| 3 | [03-realtime-synchronization.md](03-realtime-synchronization.md) | WebSocket, salas, secuencia, idempotencia, integración con SyncEngine |
| 4 | [04-conflicts-and-consistency.md](04-conflicts-and-consistency.md) | Política de conflictos por caso |
| 5 | [05-presence-and-ux.md](05-presence-and-ux.md) | Presencia ligera y estados de conexión |
| 6 | [06-security-performance.md](06-security-performance.md) | Rendimiento del canvas, límites, seguridad, resiliencia, métricas |
| 7 | [07-testing-and-implementation-phases.md](07-testing-and-implementation-phases.md) | Pruebas por fase, criterios de aceptación, orden |

## Dependencias entre fases

```
F1 Modelo/permisos ──▶ F2 Compartir/invitaciones ──┐
        │                                          ├──▶ F5 Presencia
        └──▶ F3 Tiempo real ──▶ F4 Conflictos ─────┘
                                     │
F6 Seguridad/rendimiento: transversal, se cierra al final (límites y métricas se
   introducen junto con F3; optimizaciones de canvas después de F4).
F7 Pruebas: cada fase entrega sus propias pruebas; F7 añade E2E multiusuario.
```

## Orden recomendado de implementación

| Paso | Entrega | Resultado visible |
| --- | --- | --- |
| 1 | **F1** migración de roles + RLS + `access_role` en la API | Diagramas compartidos aparecen con su rol; viewer abre en solo lectura |
| 2 | **F2** invitaciones + modal + gestión de miembros | Se puede compartir de punta a punta (sin tiempo real: recargar ve cambios) |
| 3 | **F4-a** ops de sub-entidad (`field`/`index`/`checkConstraint`) + idempotencia `batchId` | Ediciones concurrentes vía HTTP ya no se pisan (útil incluso sin WS) |
| 4 | **F3** WebSocket + salas + `diagram_ops` + `applyRemoteOperations` | Cambios de otros aparecen en vivo |
| 5 | **F4-b** rebase de pendientes locales, borrado vs edición, UI de rechazos | Consistencia garantizada y visible |
| 6 | **F5** presencia | Avatares, "editando", estado de conexión |
| 7 | **F6** endurecimiento y optimización incremental del canvas | Diagramas 100+ tablas fluidos con 5+ usuarios |
| 8 | **F7** E2E multiusuario y pruebas de carga | Criterios globales verificados |

> F4-a va antes que F3 a propósito: sin operaciones por sub-entidad, el tiempo
> real solo haría más visible que dos editores de la misma tabla se pisan.

## Fuera de alcance (etapas posteriores)

- Cursores compartidos y "arrastre en vivo" (posición efímera durante el drag).
- Transferencia de propiedad, organizaciones/equipos, multi-tenancy.
- Enlaces públicos "cualquiera con el enlace" y acceso anónimo.
- Comentarios/hilos sobre elementos, historial de versiones navegable.
- Undo colaborativo (deshacer cambios de otros); en v1 undo solo afecta lo propio.
- Edición concurrente carácter a carácter del mismo texto (notas, comentarios): v1 es LWW del campo completo.
- Notificaciones push / email de actividad.

## Criterios generales de aceptación

1. Dos navegadores con usuarios distintos editan el mismo diagrama; cada cambio
   aparece en el otro en **p95 < 500 ms** (red local/misma región).
2. Ediciones simultáneas a **propiedades distintas** (incluidas columnas distintas
   de la misma tabla) **nunca** se pierden.
3. Tras cortar la red 60 s y reconectar, ambos clientes convergen al mismo estado
   sin recargar y sin duplicados.
4. Un `viewer` no puede escribir ni por UI ni llamando a la API/WS directamente;
   revocar acceso corta su sesión en vivo en < 5 s.
5. Con 100 tablas y 3 colaboradores activos, el drag local se mantiene a ~60 fps
   (sin tareas largas > 50 ms atribuibles a ops remotas).
6. No se guarda el diagrama completo en `localStorage`/IndexedDB; solo la cola
   mínima de operaciones pendientes (comportamiento actual del `SyncEngine`).
