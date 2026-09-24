# AGENTS.md — Contexto del proyecto

Este archivo existe para que cualquier asistente de IA (o desarrollador nuevo)
entienda el proyecto sin tener que releer todo el historial de commits.
Complementa, no reemplaza, al `README.md` original del proyecto open source.

## Qué es esto

Este repositorio es un **fork personalizado de [ChartDB](https://github.com/chartdb/chartdb)**
(visualizador/editor de esquemas de bases de datos), licenciado bajo
**AGPLv3** (ver `LICENSE`). Sobre la base open source se construyó un
**backend propio en Express + Postgres/Supabase** con autenticación, un
motor de sincronización, panel de administración y auditoría — el proyecto
upstream original es solo frontend con storage local (Dexie/IndexedDB) o
Supabase directo desde el navegador; aquí eso se reemplazó por completo.

> Si sos una IA leyendo esto para orientarte: el código fuente real siempre
> tiene la última palabra sobre este documento. Si algo acá no coincide con
> lo que ves en el código, confiá en el código y considerá este archivo
> desactualizado en ese punto.

## Estructura de alto nivel

Es un solo repositorio git con **dos aplicaciones desplegadas por separado**,
no un monorepo (no hay `pnpm-workspace.yaml`; `server/` tiene su propio
`pnpm-lock.yaml`):

```
├── src/            # Frontend: React + Vite + TypeScript (SPA)
├── server/         # Backend: Express + TypeScript ("chartdb-api")
├── server/sql/     # Migraciones SQL sueltas, aplicadas a mano en Supabase
├── docs/superpowers/  # Specs y planes de diseño (ej. motor de sync)
└── AGENTS.md       # este archivo
```

Se comunican **solo por HTTP** (`VITE_API_URL` en el frontend apunta al
backend). El frontend ya NO habla directo con Supabase para datos — solo usa
`@supabase/supabase-js` para la sesión/JWT de auth. Todo el resto (leer y
escribir diagramas, tablas, relaciones, etc.) pasa por la API Express, que es
la única con acceso a Postgres.

## Backend (`server/`)

**Stack**: Express, `pg` (pool a Postgres), `jose`/`jsonwebtoken` (JWT),
`ioredis` (opcional), `express-rate-limit`, `helmet`, `cors`, `pino`, `zod`.

**Auth** (`server/src/middleware/auth.ts`): verifica el JWT de sesión de
Supabase contra el JWKS de Supabase (`jose` + `createRemoteJWKSet`, ES256).
No usa el secreto compartido legado. Devuelve 401 si falta o es inválido.

**Acceso a la base — impersonación RLS** (`server/src/config/db.ts`): el
pool se conecta como un rol de bajo privilegio dedicado, `app_backend`
(`NOINHERIT`, `NOBYPASSRLS` — falla cerrado por diseño). Dos helpers clave:
- `withUserContext(userId, fn)`: abre una transacción, hace
  `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', ...)`,
  para que las políticas RLS de Postgres se comporten igual que con Supabase
  Auth nativo.
- `withAnonContext(fn)`: igual pero con `SET LOCAL ROLE anon`, para
  endpoints públicos (waitlist, chequeo de bloqueo de login).

**Redis**: opcional (`server/src/config/redis.ts`). Si `REDIS_URL` no está
seteada, todo cae a un `Map` en memoria. Se usa para: lockout de login,
rate limiting, y una caché de 15s de la lista de usuarios admin.

**Rutas** (`server/src/modules/`, todas montadas en `server/src/app.ts`):
`auth`, `diagrams` (+ `POST /diagrams/:id/sync`, ver motor de sync abajo),
`tables`, `relationships`, `dependencies`, `areas`, `custom-types`, `notes`,
`config`, `filters`, `shares`, `admin/users`, `admin/audit`,
`admin/waitlist`. Casi todas requieren autenticación excepto `/health`,
`/auth/login` y el registro a la waitlist.

**Autorización de admin**: no hay middleware `requireAdmin` en Express — la
autorización vive en Postgres. Las rutas de admin llaman a funciones
`SECURITY DEFINER` (`get_admin_users()`, `assign_user_role()`,
`delete_user_data()`) y las políticas RLS + los `REVOKE/GRANT EXECUTE` de
`server/sql/security_hardening.sql` son la barrera real. Roles conocidos:
`super_admin`, `admin`, `user` (default).

**Migraciones**: NO hay framework de migraciones, son archivos SQL sueltos
en `server/sql/` que se aplican a mano contra Supabase (SQL editor o psql).
Cada uno documenta en su cabecera qué hace y cuándo aplicarlo. Si agregás
una columna/tabla nueva, seguí este mismo patrón: un archivo
`YYYY-MM-DD-descripcion.sql` con comentario explicando el propósito.

## Frontend (`src/`)

**Contexts principales** (`src/context/`, 17 providers): `auth-context`,
`chartdb-context` (el central: diagrama actual, tablas, mutaciones),
`canvas-context`, `storage-context`, `sync-status-context`,
`diagram-filter-context`, `diff-context`, `dialog-context`,
`history-context`/`redo-undo-stack-context`, y varios de UI/config.

**Storage**: NO queda código de Dexie/IndexedDB en `src/` — se retiró por
completo. `StorageProviderSelector` es hoy un passthrough trivial a
`ApiStorageProvider` (`src/context/storage-context/api-storage-provider.tsx`).
No existe modo anónimo/offline: todo diagrama requiere sesión iniciada.

## El motor de sincronización (lo más importante para entender el proyecto)

Ver el diseño original completo en
`docs/superpowers/specs/2026-09-10-sync-engine-design.md`. Resumen:

**Problema que resuelve**: el `ApiStorageProvider` original disparaba una
request HTTP por cada mutación individual (editar un campo = 1 GET + 2
PATCH). El `SyncEngine` (`src/context/storage-context/sync-engine.ts`)
agrupa mutaciones en una cola en memoria, las debounce (700ms, tope duro de
4s), y las manda como **un solo `POST /diagrams/:id/sync`** con todas las
operaciones del lote. Espeja la cola pendiente en `localStorage` para
sobrevivir a un refresh/crash de la pestaña, y usa `fetch({keepalive})`
para lotes chicos así un cierre de pestaña no cancela el último guardado.

**Contraparte en el servidor**: `server/src/modules/sync/sync.service.ts`
(`applyOperation`, `syncService.apply`) aplica el lote en una sola
transacción Postgres, reutilizando los servicios existentes por entidad.

**Detección de conflictos**: `diagrams.version` es un contador global por
diagrama (no por fila — un CRDT/versionado por fila quedó explícitamente
fuera de alcance). Cada sesión (pestaña) se identifica con un `sessionId`
propio (`sessionStorage`, no `localStorage` — así dos pestañas del mismo
navegador siguen contando como sesiones distintas) que el servidor guarda en
`diagrams.last_sync_session_id`. Esto permite distinguir un conflicto real
(otra sesión avanzó la versión) de un simple reintento de la misma sesión
cuyo ack se perdió por la red.

## Colaboración (en curso, rama `develop`)

Plan completo en `docs/collaboration/` (README = índice y orden de fases).
Implementado hasta ahora:

- **Fase 1 — roles**: `owner` implícito (`diagrams.user_id`), `editor`/`viewer`
  en `diagram_shares`. La API devuelve `accessRole` y `owner` en
  `GET /diagrams[/:id]` (expresión `ACCESS_ROLE_SQL` en `diagrams.service.ts`);
  `/sync` rechaza viewers con `403 forbidden_role`; el editor abre en
  `readonly` para viewers (`resolveReadonly` en `src/lib/domain/diagram-access.ts`).
  Migración `server/sql/2026-09-23-collab-roles.sql` (cierra además un INSERT
  abierto en `diagram_shares` que permitía darse acceso a cualquier diagrama).
- **Fase 2 — invitaciones**: tabla `diagram_invitations` sin acceso directo,
  todo vía funciones SECURITY DEFINER (`server/sql/2026-09-23-collab-invitations.sql`);
  módulo `server/src/modules/invitations/`; mailer opcional Resend
  (`RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`). Frontend: `ShareDiagramDialog`
  (registrado en `dialog-context`), botón en la barra del editor,
  `PendingInvitations` en el Dashboard y ruta `/invite/:token`.
  Ojo: dentro de Postgres `auth.email()` es NULL (el backend solo fija `sub` y
  `role` en los claims); usar `current_user_email()`.

## Bugs reales encontrados y arreglados (sesión 2026-09-12)

Estos no son solo optimizaciones de rendimiento — dos de ellos corrompían
datos o rompían el guardado silenciosamente. Si algo de esto reaparece,
empezar por acá:

1. **Corrupción del filtro guardado** (`diagram-filter-provider.tsx`): el
   filtro de visibilidad de tablas se marcaba como "cargado" antes de que
   terminara de llegar del servidor. Si la carga tardaba >400ms, el
   auto-guardado (debounced) disparaba primero con un valor vacío temporal y
   **sobreescribía el filtro real guardado**. Arreglado: el ref que marca
   "filtro cargado para este diagrama" ahora se setea solo después de que
   resuelve el fetch real.

2. **Falsos "conflictos de sync"**: ver sección de arriba (`sessionId` +
   `last_sync_session_id`). Antes, cualquier reintento con ack perdido se
   reportaba como "otra sesión sobrescribió tus cambios" aunque fuera la
   misma pestaña.

3. **`[React Flow] Couldn't create edge for target handle id` (error#008)**
   en diagramas grandes o con Áreas: dos efectos separados en
   `canvas.tsx` contaban las relaciones hacia un mismo campo con criterios
   distintos (uno contaba TODAS las relaciones, el otro solo las de tablas
   visibles), así que al ocultar/mostrar tablas los índices de "handle" se
   desalineaban con los handles realmente renderizados. Arreglado:
   ambos ahora derivan el índice de la lista completa de relaciones/
   dependencias, en orden estable, sin importar visibilidad.

4. **Cascada de re-renders con Áreas**: `src/lib/graph.ts` (grafo de
   solapamiento de tablas) generaba un `lastUpdated: Date.now()` nuevo en
   cada llamada aunque el grafo no hubiera cambiado realmente, lo que
   disparaba efectos dependientes de `overlapGraph.lastUpdated` sin
   necesidad. Combinado con tablas que no tenían `parentAreaId` persistido
   (corregido automáticamente al cargar, ver `checkParentAreas` en
   `canvas.tsx`), esto producía cientos de re-renders y warnings repetidos
   en diagramas con Áreas. Arreglado: `lastUpdated` solo cambia si el grafo
   cambió de verdad.

5. **GET+flush redundante por edición de campo/índice/constraint**
   (`chartdb-context/chartdb-provider.tsx`): varios mutadores
   (`updateField`, `addIndex`, etc.) volvían a pedirle la tabla al servidor
   en vez de usar el estado local ya disponible, reintroduciendo parte del
   problema que el motor de sync existía para resolver.

6. **Drag/resize de tablas** enviaba la tabla completa (fields, indexes,
   checkConstraints) como patch en vez de solo `{id, x, y}` / `{id, width}`.

## Cómo correr esto localmente

Backend (`server/README.md` tiene el detalle completo):
```
cd server
cp .env.example .env   # completar DATABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_ANON_KEY, CORS_ORIGIN
pnpm install
pnpm dev                # http://localhost:3001
```
Requiere que el rol `app_backend` ya exista en la base (ver README del
server) y que las migraciones sueltas de `server/sql/` estén aplicadas —
sin la columna `version`, `/diagrams/:id/sync` falla con 500 y ningún
guardado persiste (el cliente lo reintenta indefinidamente mostrando
"Error al guardar").

Frontend:
```
pnpm install
pnpm dev                # http://localhost:5173, usa VITE_API_URL
```

## Testing

- Frontend: `pnpm test` / `pnpm test:ci` (Vitest, ~111 archivos de test).
- Backend: `cd server && pnpm test` (Vitest, incluye tests de integración
  que requieren `INTEGRATION=1` y una Postgres real).

## Notas para la próxima sesión

- Sigue pendiente borrar manualmente un campo de prueba `field_8` en la
  tabla `acc_ud_compartidas` del diagrama "SQL Import" (se agregó para
  verificar un fix, no se pudo automatizar el borrado por política de
  seguridad sobre datos reales).
- El DOM de diagramas con muchas tablas (60+) sigue siendo grande (~13k
  nodos) porque cada tabla monta todos sus campos aunque estén colapsados
  (solo se ocultan con CSS). Virtualizar las filas de campos dentro de
  `TableNode` es la siguiente optimización de rendimiento pendiente, no
  implementada todavía.
