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

| Comando | Descripción |
|---|---|
| `pnpm dev` | API en watch mode |
| `pnpm build` | Compila a `dist/` |
| `pnpm start` | Corre `dist/server.js` |
| `pnpm test` | Unit + isolation (isolation requiere INTEGRATION=1) |
| `pnpm typecheck` | TypeScript sin emitir |

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

## Rollout gradual

1. Desplegar API sin `VITE_API_URL` en el frontend (fallback Supabase directo).
2. Activar `VITE_API_URL` para un usuario de prueba.
3. Activar para todos; mantener `SupabaseStorageProvider` como fallback.
4. Cuando esté estable, se pueden retirar llamadas directas `supabase.from/rpc` del frontend.
