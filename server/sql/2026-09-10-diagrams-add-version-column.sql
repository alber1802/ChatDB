-- server/sql/2026-09-10-diagrams-add-version-column.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql) antes de desplegar
-- el backend con el endpoint /diagrams/:id/sync.
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
