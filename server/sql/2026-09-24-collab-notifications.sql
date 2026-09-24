-- server/sql/2026-09-24-collab-notifications.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql), DESPUÉS de
-- 2026-09-23-collab-roles.sql y 2026-09-23-collab-invitations.sql.
--
-- Notificaciones internas de colaboración (campana en la app). Se generan
-- solas con triggers, así que cualquier camino que toque el acceso (compartir
-- directo, aceptar invitación, cambiar rol, quitar acceso, abandonar)
-- notifica sin que el backend tenga que acordarse:
--
--   diagram_shared       → al miembro, cuando el owner lo añade directamente
--   invitation_received  → al invitado (si ya tiene cuenta), al crear invitación por email
--   invitation_accepted  → al owner, cuando alguien acepta su invitación
--   role_changed         → al miembro, cuando cambia su rol
--   access_removed       → al miembro, cuando el owner le quita el acceso
--   member_left          → al owner, cuando un miembro abandona el diagrama
--
-- Los usuarios solo pueden leer, marcar como leídas y borrar SUS
-- notificaciones; nadie puede insertarlas directamente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    type        text NOT NULL CHECK (type IN (
                    'diagram_shared', 'invitation_received', 'invitation_accepted',
                    'role_changed', 'access_removed', 'member_left')),
    diagram_id  text,              -- sin FK: la notificación sobrevive al diagrama
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_recent
    ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_user_unread
    ON public.user_notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_notifications FROM anon, authenticated;
GRANT SELECT, DELETE ON public.user_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;

CREATE POLICY "user_notifications: own select" ON public.user_notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_notifications: own mark read" ON public.user_notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_notifications: own delete" ON public.user_notifications
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── Helpers internos (sin EXECUTE para usuarios) ───────────────────────────

CREATE OR REPLACE FUNCTION public.notify_user(
    p_user_id uuid, p_type text, p_diagram_id text, p_payload jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  INSERT INTO public.user_notifications (user_id, type, diagram_id, payload)
  SELECT p_user_id, p_type, p_diagram_id, coalesce(p_payload, '{}'::jsonb)
   WHERE p_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.profile_name(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT coalesce(up.display_name, split_part(u.email, '@', 1))
    FROM auth.users u LEFT JOIN public.user_profiles up ON up.user_id = u.id
   WHERE u.id = p_user_id;
$$;

-- ─── Trigger: cambios de acceso en diagram_shares ───────────────────────────

CREATE OR REPLACE FUNCTION public.on_diagram_share_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_diagram_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT name INTO v_diagram_name FROM public.diagrams WHERE id = OLD.diagram_id;
    -- Borrado en cascada del diagrama: no hay nada útil que notificar.
    IF v_diagram_name IS NULL THEN RETURN OLD; END IF;
    IF v_actor = OLD.shared_with THEN
      PERFORM public.notify_user(OLD.owner_id, 'member_left', OLD.diagram_id,
        jsonb_build_object('diagram_name', v_diagram_name,
                           'member_name', public.profile_name(OLD.shared_with)));
    ELSE
      PERFORM public.notify_user(OLD.shared_with, 'access_removed', OLD.diagram_id,
        jsonb_build_object('diagram_name', v_diagram_name,
                           'by_name', public.profile_name(v_actor)));
    END IF;
    RETURN OLD;
  END IF;

  SELECT name INTO v_diagram_name FROM public.diagrams WHERE id = NEW.diagram_id;

  IF TG_OP = 'INSERT' THEN
    IF v_actor = NEW.shared_with THEN
      -- El propio miembro creó la fila: aceptó una invitación.
      PERFORM public.notify_user(NEW.owner_id, 'invitation_accepted', NEW.diagram_id,
        jsonb_build_object('diagram_name', v_diagram_name, 'role', NEW.role,
                           'member_name', public.profile_name(NEW.shared_with)));
    ELSE
      PERFORM public.notify_user(NEW.shared_with, 'diagram_shared', NEW.diagram_id,
        jsonb_build_object('diagram_name', v_diagram_name, 'role', NEW.role,
                           'by_name', public.profile_name(coalesce(v_actor, NEW.owner_id))));
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.notify_user(NEW.shared_with, 'role_changed', NEW.diagram_id,
      jsonb_build_object('diagram_name', v_diagram_name, 'role', NEW.role,
                         'by_name', public.profile_name(v_actor)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diagram_shares_notify ON public.diagram_shares;
CREATE TRIGGER diagram_shares_notify
    AFTER INSERT OR UPDATE OF role OR DELETE ON public.diagram_shares
    FOR EACH ROW EXECUTE FUNCTION public.on_diagram_share_change();

-- ─── Trigger: invitaciones por email ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_diagram_invitation_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_invitee uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Solo si el email ya tiene cuenta; si no, le llega por correo/enlace.
    SELECT id INTO v_invitee FROM auth.users WHERE lower(email) = NEW.email;
    IF v_invitee IS NOT NULL THEN
      PERFORM public.notify_user(v_invitee, 'invitation_received', NEW.diagram_id,
        jsonb_build_object(
          'invitation_id', NEW.id,
          'role', NEW.role,
          'diagram_name', (SELECT name FROM public.diagrams WHERE id = NEW.diagram_id),
          'by_name', public.profile_name(NEW.invited_by)));
    END IF;
  ELSIF NEW.status <> 'pending' AND OLD.status = 'pending' THEN
    -- Aceptada, rechazada, revocada o caducada: la notificación deja de ser
    -- accionable (la UI oculta Aceptar/Rechazar si payload.resolved = true).
    UPDATE public.user_notifications
       SET payload = payload || jsonb_build_object('resolved', true, 'status', NEW.status),
           read_at = coalesce(read_at, now())
     WHERE type = 'invitation_received'
       AND payload->>'invitation_id' = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diagram_invitations_notify ON public.diagram_invitations;
CREATE TRIGGER diagram_invitations_notify
    AFTER INSERT OR UPDATE OF status ON public.diagram_invitations
    FOR EACH ROW EXECUTE FUNCTION public.on_diagram_invitation_change();

REVOKE EXECUTE ON FUNCTION
    public.notify_user(uuid, text, text, jsonb),
    public.profile_name(uuid),
    public.on_diagram_share_change(),
    public.on_diagram_invitation_change()
  FROM PUBLIC, anon, authenticated;

COMMIT;

-- Rollback:
--   DROP TRIGGER diagram_invitations_notify ON public.diagram_invitations;
--   DROP TRIGGER diagram_shares_notify ON public.diagram_shares;
--   DROP FUNCTION public.on_diagram_invitation_change(), public.on_diagram_share_change(),
--     public.profile_name(uuid), public.notify_user(uuid, text, text, jsonb);
--   DROP TABLE public.user_notifications;
