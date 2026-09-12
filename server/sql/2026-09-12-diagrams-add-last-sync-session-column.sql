-- server/sql/2026-09-12-diagrams-add-last-sync-session-column.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql).
--
-- Guarda qué sesión de sync (pestaña/cliente) hizo el último write que
-- avanzó `diagrams.version`. Permite a syncService.apply distinguir un
-- "conflicto" real (otra sesión avanzó la versión) de un simple reintento
-- de la MISMA sesión cuyo ack se perdió (el servidor ya había aplicado el
-- lote, pero el cliente nunca vio la respuesta) — ver
-- docs/superpowers/specs/2026-09-10-sync-engine-design.md.
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS last_sync_session_id text;
