# Motor de sincronización backend — Diseño

Fecha: 2026-09-10
Estado: aprobado por el usuario, pendiente de plan de implementación

## Contexto

ChartDB ya tiene construida la mayor parte de la arquitectura cliente/servidor que
originalmente parecía haber que diseñar desde cero:

- Backend Express (`server/`) sobre Postgres sirviéndose de Supabase, con
  impersonación RLS por request (`SET LOCAL ROLE authenticated` +
  `set_config('request.jwt.claim.sub', uid)`), JWT verificado contra el JWKS de
  Supabase, rate limiting, y módulos REST completos para diagrams / tables /
  relationships / dependencies / areas / custom-types / notes / config /
  filters / shares / admin / auth.
- Modelo de datos ya relacional (una fila por tabla/relación/área/etc.), no un
  blob JSON versionado — decisión ya tomada y correcta para este caso de uso.
- Frontend con tres proveedores de storage intercambiables vía
  `StorageProviderSelector` (`src/context/storage-context/storage-provider-selector.tsx`):
  `ApiStorageProvider` → `SupabaseStorageProvider` → Dexie/IndexedDB local.
- Redis ya integrado (`ioredis`) pero solo para lockout de login y una caché
  corta de lista de admins.

El problema real detectado: `ApiStorageProvider` dispara una request HTTP por
cada mutación individual, sin agrupar, sin debounce a nivel de red, sin número
de versión para detectar conflictos, sin indicador visual de guardado y sin
reintento ante fallo de red. Ejemplo confirmado en
`src/context/chartdb-context/chartdb-provider.tsx:654-719` (`updateField`):
cada edición de un campo dispara secuencialmente un `GET` (releer la tabla),
un `PATCH` del diagrama (solo por el timestamp) y un `PATCH` de la tabla
completa.

## Decisiones ya tomadas (con el usuario)

1. **Backend obligatorio.** Se elimina el modo local sin cuenta. Dexie/IndexedDB
   se retira por completo al finalizar la migración.
2. **Un solo camino de persistencia.** Se retira también `SupabaseStorageProvider`
   (llamadas directas del frontend a Supabase). Todo pasa por la API Express.
3. **Alcance de esta ronda:** solo el motor de sync (batching, debounce,
   autosave, optimistic UI, versionado de conflictos, resiliencia ante fallos
   de red). Migraciones SQL versionadas del esquema Postgres y estrategia de
   cache Redis para lecturas quedan explícitamente para una fase posterior.

## Consecuencias aceptadas (fuera de alcance de esta ronda, pero a tener en cuenta)

- Flujos que hoy funcionan sin login usando el storage local (ver
  `src/pages/examples-page/examples-page.tsx`, que llama `addDiagram`/
  `deleteDiagram` de `useStorage()` para cargar un ejemplo) van a requerir
  cuenta autenticada una vez retirado Dexie. No se resuelve en esta ronda; se
  documenta como consecuencia directa de la decisión 1, a revisar cuando se
  aborde el flujo de onboarding/ejemplos.
- El esquema Postgres actual fue creado a mano en el dashboard de Supabase
  (solo `server/sql/security_hardening.sql` — políticas RLS — está
  versionado en el repo). La migración `version` añadida por este diseño se
  aplicará como SQL suelto documentado, sin introducir aún un sistema de
  migraciones versionado completo (eso es la fase posterior ya acordada).

## Arquitectura

```
Componente React (TableNode, side panel, etc.)
        │  llama a funciones de ChartDBContext (misma firma pública que hoy)
        ▼
ChartDBProvider (setState local = optimistic, instantáneo)
        │  encola una operación en vez de awaitar la red
        ▼
SyncEngine (nuevo, dentro de storage-context)
  - cola en memoria de operaciones {entity, entityId, op, patch}
  - espejo de la cola en localStorage (solo operaciones pendientes, no el diagrama)
  - debounce configurable (punto de partida 600-800ms, a ajustar con benchmark)
  - flush inmediato en: beforeunload/visibilitychange, salir del editor, atajo de guardado
        │  UNA petición HTTP agrupando N operaciones
        ▼
POST /diagrams/:id/sync   (nuevo endpoint)
        │  1 transacción Postgres
        ▼
Reutiliza los *.service.ts existentes por módulo (diagrams/tables/relationships/...)
        │  incrementa diagrams.version
        ▼
Respuesta: { version, conflicts?: [{entity, entityId, serverRow}] }
```

`ChartDBProvider` mantiene la misma superficie pública (`updateField`,
`updateTable`, `addTable`, etc.) — los ~63 archivos que hoy consumen
`useChartDB()` no cambian. Solo cambia la implementación interna: en vez de
`await db.updateTable(...)`, se llama a `syncEngine.enqueue(...)` y se
continúa sin bloquear. Esto respeta YAGNI: no se toca cada consumidor, solo
`chartdb-provider.tsx` y la capa de storage.

## Componentes nuevos

**Frontend**
- `src/context/storage-context/sync-engine.ts` — cola, debounce, flush,
  reintento con backoff, espejo en localStorage.
- `src/context/sync-status-context/` — contexto de **estado de UI** (no de
  servidor): `idle | saving | saved | error | offline`. Separado
  deliberadamente de `chartdb-context` (estado de servidor) y de
  `canvas-context` (estado visual efímero), siguiendo la separación que ya
  pediste en el punto 13 de tu spec original.
- Componente de indicador visual (topbar) que lee `sync-status-context`.
- `ApiStorageProvider` pierde sus llamadas 1:1 y expone en su lugar el punto
  de entrada al `SyncEngine`.

**Backend**
- `server/src/modules/diagrams/sync.routes.ts` + `sync.service.ts` — nuevo
  endpoint `POST /diagrams/:id/sync`, transaccional, reutiliza los servicios
  existentes de cada módulo.
- Migración SQL suelta: `ALTER TABLE diagrams ADD COLUMN version integer NOT
  NULL DEFAULT 1;` (y equivalente por fila si se decide versionar también a
  nivel de tabla/relación individual — ver sección de conflictos).

## Contrato de la API

```
POST /diagrams/:id/sync
Body:
{
  "baseVersion": 42,
  "operations": [
    { "entity": "table", "op": "update", "id": "t1", "patch": { "x": 500, "y": 300 } },
    { "entity": "field", "op": "update", "id": "f7", "patch": { "name": "email" }, "parentId": "t1" },
    { "entity": "relationship", "op": "delete", "id": "r3" }
  ]
}

Respuesta 200:
{
  "version": 43,
  "conflicts": []   // o [{ "entity": "table", "id": "t1", "serverRow": {...} }]
}
```

No se introduce un lenguaje de operaciones genérico tipo CRDT/JSON-Patch
completo — el set de `op` se limita a `create | update | delete` por entidad,
igual que ya existe en las rutas REST actuales, solo que agrupadas.

## Optimistic UI

El estado de React ya se actualiza al instante (comportamiento actual). El
cambio es que la función mutadora deja de esperar la respuesta de red antes
de continuar. Si el flush eventualmente falla de forma no recuperable (p.ej.
403 por permisos, 409 de conflicto no auto-resoluble), se notifica vía
`sync-status-context` con `status: 'error'` y un mensaje accionable; el
cambio local permanece en pantalla (no se revierte automáticamente) y se
reintenta si el usuario lo confirma o si vuelve la conexión.

## Conflictos

Se añade `version` (entero) en `diagrams`, incrementado en cada sync
aplicado con éxito. El cliente manda `baseVersion` (la última vista). Dado
que se descarta CRDT/event-sourcing: **last-write-wins por fila** a nivel de
entidad individual — si el servidor detecta que una fila cambió desde que el
cliente la vio por acción de otro colaborador (relevante porque el módulo
`shares` ya permite colaboradores), aplica igual la operación entrante pero
lo reporta en `conflicts` para que la UI pueda avisar "algunos cambios fueron
sobrescritos por otra sesión". No se bloquea el guardado del propio usuario.

## Resiliencia

- Cola pendiente espejada en `localStorage` (solo operaciones, tamaño
  mínimo) para sobrevivir a un refresh de página.
- Reintento con backoff exponencial mientras la pestaña siga abierta y haya
  operaciones pendientes.
- Sin conexión: `sync-status-context` pasa a `offline`; la cola sigue
  creciendo en memoria/localStorage hasta que vuelva la conexión.

## Testing

No existe hoy cobertura para esta capa. Se necesita:
- Unit: `SyncEngine` (agrupación, debounce, flush inmediato en los triggers
  listados, reintento con backoff, límites de tamaño de cola).
- Backend: endpoint `/sync` — aplicación transaccional correcta, rollback
  ante error parcial, detección y reporte de conflicto de versión.
- Integración: ráfaga de N operaciones sobre M entidades → 1 sola request →
  estado final correcto en DB y en el cliente.
- Regresión: los ~63 consumidores de `useChartDB()` no cambian de
  comportamiento observable (misma firma, mismo optimistic update
  instantáneo).

## Benchmark antes/después

Antes de implementar, capturar línea base con el `ApiStorageProvider` actual:
número de requests HTTP y tiempo total al (a) editar 20 campos seguidos,
(b) arrastrar 10 tablas seleccionadas simultáneamente, (c) importar un
esquema de 100 tablas. Comparar contra el motor nuevo con los mismos
escenarios.
