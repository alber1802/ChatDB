-- server/sql/2026-09-23-collab-roles.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql).
--
-- Fase 1 de colaboración (docs/collaboration/01-architecture.md):
--   * diagram_shares admite los roles 'editor' y 'viewer' (antes solo 'editor').
--   * Políticas de diagram_shares pasan de `public` a `authenticated` y quedan:
--       SELECT  → cualquier miembro del diagrama (owner, editor o viewer)
--       UPDATE  → solo el owner (cambiar rol)
--       DELETE  → el owner (revocar) o el propio miembro (abandonar)
--       INSERT  → ninguno directo; las altas llegan por invitaciones (Fase 2)
--     SEGURIDAD: la política INSERT anterior solo exigía `auth.uid() = owner_id`
--     sin comprobar que el diagrama fuese del llamante, así que cualquier
--     usuario que conociera un diagram_id podía insertarse como editor.
--     Esta migración la elimina.
--   * can_view_diagram / can_edit_diagram fijan search_path (hardening de
--     funciones SECURITY DEFINER). Su lógica no cambia: can_edit sigue
--     aceptando solo 'editor', así que un 'viewer' no puede escribir en
--     ninguna tabla hija.
--
-- Es compatible con el backend anterior y con el nuevo: la API calcula el rol
-- con una expresión SQL propia (ACCESS_ROLE_SQL en diagrams.service.ts) y no
-- depende de objetos creados aquí.

BEGIN;

-- 1) Roles admitidos
ALTER TABLE public.diagram_shares
    DROP CONSTRAINT IF EXISTS diagram_shares_role_check;
ALTER TABLE public.diagram_shares
    ADD CONSTRAINT diagram_shares_role_check CHECK (role IN ('editor', 'viewer'));

ALTER TABLE public.diagram_shares
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) Políticas de diagram_shares
DROP POLICY IF EXISTS "diagram_shares: owner can delete" ON public.diagram_shares;
DROP POLICY IF EXISTS "diagram_shares: owner can insert" ON public.diagram_shares;
DROP POLICY IF EXISTS "diagram_shares: owner can select" ON public.diagram_shares;
DROP POLICY IF EXISTS "diagram_shares: shared_with can select" ON public.diagram_shares;

CREATE POLICY "diagram_shares: members can select" ON public.diagram_shares
    FOR SELECT TO authenticated
    USING (public.can_view_diagram(diagram_id, auth.uid()));

-- WITH CHECK exige además que el diagrama sea del llamante, y solo se concede
-- UPDATE sobre (role, updated_at): sin esto, un owner podría mover una fila
-- suya a otro `diagram_id` y darse acceso a un diagrama ajeno.
CREATE POLICY "diagram_shares: owner can update role" ON public.diagram_shares
    FOR UPDATE TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (
        auth.uid() = owner_id
        AND EXISTS (
            SELECT 1 FROM public.diagrams d
            WHERE d.id = diagram_id AND d.user_id = auth.uid()
        )
    );

REVOKE INSERT, UPDATE ON public.diagram_shares FROM authenticated, anon;
GRANT UPDATE (role, updated_at) ON public.diagram_shares TO authenticated;

CREATE POLICY "diagram_shares: owner revokes or member leaves" ON public.diagram_shares
    FOR DELETE TO authenticated
    USING (auth.uid() = owner_id OR auth.uid() = shared_with);

-- 3) Hardening de las funciones de acceso (misma lógica, search_path fijo)
CREATE OR REPLACE FUNCTION public.can_view_diagram(p_diagram_id text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.diagrams d WHERE d.id = p_diagram_id AND d.user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.diagram_shares ds WHERE ds.diagram_id = p_diagram_id AND ds.shared_with = p_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_diagram(p_diagram_id text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.diagrams d WHERE d.id = p_diagram_id AND d.user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.diagram_shares ds WHERE ds.diagram_id = p_diagram_id AND ds.shared_with = p_user_id AND ds.role = 'editor'
  );
$function$;

COMMIT;

-- Rollback (si hiciera falta):
--   ALTER TABLE diagram_shares DROP CONSTRAINT diagram_shares_role_check;
--   UPDATE diagram_shares SET role = 'editor' WHERE role = 'viewer';  -- o borrar esas filas
--   ALTER TABLE diagram_shares ADD CONSTRAINT diagram_shares_role_check CHECK (role = 'editor');
--   y recrear las cuatro políticas originales (owner select/insert/delete, shared_with select).
