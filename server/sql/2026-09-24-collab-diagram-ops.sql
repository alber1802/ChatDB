-- server/sql/2026-09-24-collab-diagram-ops.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql). Opcional para que
-- el guardado funcione (el backend detecta si la tabla existe), pero sin ella
-- no hay idempotencia: un reintento cuyo ack se perdió se vuelve a aplicar.
--
-- Log corto de lotes aplicados por diagrama
-- (docs/collaboration/03-realtime-synchronization.md):
--   * Fase 4-a: idempotencia por batch_id. Si llega un lote cuyo batch_id ya
--     está aquí, syncService.apply devuelve el `result` guardado sin reaplicar.
--   * Fase 3: recuperar huecos al reconectar ("dame los lotes desde la
--     versión N") y difundir por WebSocket.
-- No es event sourcing: el estado vive en las tablas; esto es un buffer con
-- retención (últimas ~1000 versiones o 24 h, lo borra el propio backend).

BEGIN;

CREATE TABLE IF NOT EXISTS public.diagram_ops (
    diagram_id  text        NOT NULL REFERENCES public.diagrams(id) ON DELETE CASCADE,
    version     integer     NOT NULL,
    batch_id    uuid        NOT NULL,
    session_id  text,
    user_id     uuid        NOT NULL,
    operations  jsonb       NOT NULL,   -- solo las ops aplicadas
    result      jsonb       NOT NULL,   -- respuesta devuelta al cliente
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (diagram_id, version),
    UNIQUE (diagram_id, batch_id)
);

ALTER TABLE public.diagram_ops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diagram_ops FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.diagram_ops TO authenticated;

CREATE POLICY "diagram_ops: members read" ON public.diagram_ops
    FOR SELECT TO authenticated
    USING (public.can_view_diagram(diagram_id, auth.uid()));

CREATE POLICY "diagram_ops: editors append" ON public.diagram_ops
    FOR INSERT TO authenticated
    WITH CHECK (public.can_edit_diagram(diagram_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "diagram_ops: editors trim" ON public.diagram_ops
    FOR DELETE TO authenticated
    USING (public.can_edit_diagram(diagram_id, auth.uid()));

COMMIT;

-- Rollback:
--   DROP TABLE public.diagram_ops;
