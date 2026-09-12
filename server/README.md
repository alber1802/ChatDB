# ChartDB API (Node.js + Express + Postgres/Supabase RLS)

## Requisitos

- Node >= 20
- pnpm >= 9
- Rol Postgres `app_backend` (sin `BYPASSRLS`) creado en Supabase
- JWT Secret de Supabase (Dashboard → Settings → API)
- Connection string del **pooler en modo Transaction** (puerto 6543)

## Setup local

```bash
cd server
cp .env.example .env
# Edita .env: DATABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_ANON_KEY, CORS_ORIGIN
pnpm install
pnpm dev
```

Health check: `GET http://localhost:3001/health`

## Scripts (siempre pnpm)

| Comando          | Descripción                                         |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | API en watch mode                                   |
| `pnpm build`     | Compila a `dist/`                                   |
| `pnpm start`     | Corre `dist/server.js`                              |
| `pnpm test`      | Unit + isolation (isolation requiere INTEGRATION=1) |
| `pnpm typecheck` | TypeScript sin emitir                               |

## Seguridad

- Cada request autenticado abre una transacción con:
    - `SET LOCAL ROLE authenticated`
    - `set_config('request.jwt.claim.sub', uid, true)`
- RLS de Postgres sigue siendo la fuente de verdad (owner / shares / admin).
- El rol de conexión `app_backend` es `NOINHERIT` + `NOBYPASSRLS` → fail-closed si se olvida el `SET LOCAL ROLE`.
- Login endurecido en `POST /auth/login` (cooldown + bloqueo server-side; Redis opcional).

## Frontend

Configura en el SPA:

```env
VITE_API_URL=http://localhost:3001
```

Con eso, `StorageProviderSelector` usa `ApiStorageProvider` y el login pasa por el backend.

## Deploy (Heroku / Docker)

```bash
cd server
docker build -t chartdb-api .
docker run --env-file .env -p 3001:3001 chartdb-api
```

Variables de entorno mínimas: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN`.

## Rollout

El backend es ahora la única fuente de persistencia: no existen ya
`SupabaseStorageProvider` ni almacenamiento local (Dexie/IndexedDB) como
alternativas. Antes de desplegar:

1. Aplicar `server/sql/2026-09-10-diagrams-add-version-column.sql` contra la
   base de datos de producción.
2. Desplegar la API con el endpoint `POST /diagrams/:id/sync`.
3. Desplegar el frontend con `VITE_API_URL` apuntando a la API.
4. Confirmar en el indicador de la barra superior ("Guardando…/Guardado/Error/
   Sin conexión") que la sincronización funciona antes de anunciar el cambio
   a los usuarios.

Dos consecuencias a tener en cuenta:

- **Ya no hay flujo anónimo.** Al desaparecer Dexie/IndexedDB y el acceso
  directo a Supabase, toda la persistencia pasa por la API autenticada: abrir
  un diagrama de ejemplo o empezar uno nuevo sin iniciar sesión ya no es
  posible. Es una consecuencia aceptada en el documento de diseño
  (`docs/superpowers/specs/2026-09-10-sync-engine-design.md`), no un fallo.
- **El paso 1 no es opcional.** Si se despliega la API sin haber aplicado la
  migración de la columna `version`, el `SELECT version ... FOR UPDATE` de
  `POST /diagrams/:id/sync` falla y ninguna edición se guarda: el cliente
  reencola el lote y el indicador se queda en error. Aplicar la migración
  antes de desplegar la API.
