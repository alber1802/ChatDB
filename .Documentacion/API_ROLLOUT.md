# Backend API rollout notes

## Phase A — Deploy API only
- Deploy `server/` as a separate process/dyno (`chatdb-api`).
- Do **not** set `VITE_API_URL` yet — frontend keeps using `SupabaseStorageProvider`.

## Phase B — Canary
- Set `VITE_API_URL` (or runtime `window.env.API_URL`) for a test build.
- Prefer same-origin `/api` via nginx proxy (`API_UPSTREAM`) to simplify CORS.
- Verify login lockout, diagram CRUD, admin pages.

## Phase C — Full cutover
- Enable `VITE_API_URL` for all users.
- Keep `SupabaseStorageProvider` in the repo as emergency fallback
  (`StorageProviderSelector` falls back when API URL is empty).

## Phase D — Cleanup (later)
- Remove direct `supabase.from/rpc` calls from admin/storage once stable.
- Optionally tighten anon grants if all data traffic goes through the API.
 