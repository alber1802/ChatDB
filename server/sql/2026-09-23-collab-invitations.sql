-- server/sql/2026-09-23-collab-invitations.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql), DESPUÉS de
-- 2026-09-23-collab-roles.sql.
--
-- Fase 2 de colaboración (docs/collaboration/02-sharing-and-permissions.md):
-- dos formas de compartir: (a) directa con un usuario del sistema elegido en un
-- selector con búsqueda, y (b) invitación por email (registrados o no).
--
-- Diseño:
--   * La tabla diagram_invitations tiene RLS activado y NINGUNA política: no se
--     lee ni escribe directamente. Todo pasa por funciones SECURITY DEFINER
--     que validan quién llama (mismo patrón que assign_user_role).
--   * El token del enlace nunca se guarda: solo su sha256 (token_hash), que
--     calcula el backend.
--   * Errores de negocio: RAISE EXCEPTION con el código como mensaje
--     ('invitation_exists', 'already_member', …). El backend los traduce a
--     HTTP en invitations.service.ts (mapInvitationError).
--   * El backend fija request.jwt.claims solo con {sub, role}, así que
--     auth.email() es NULL aquí: el email del llamante sale de auth.users vía
--     current_user_email().

BEGIN;

CREATE TABLE IF NOT EXISTS public.diagram_invitations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id   text NOT NULL REFERENCES public.diagrams(id) ON DELETE CASCADE,
    email        text NOT NULL CHECK (email = lower(trim(email)) AND email <> ''),
    role         text NOT NULL CHECK (role IN ('editor', 'viewer')),
    invited_by   uuid NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    token_hash   text NOT NULL UNIQUE,
    status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
    expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
    created_at   timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz
);

-- Una sola invitación activa por (diagrama, email)
CREATE UNIQUE INDEX IF NOT EXISTS diagram_invitations_one_pending
    ON public.diagram_invitations (diagram_id, email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS diagram_invitations_email_pending
    ON public.diagram_invitations (email) WHERE status = 'pending';

ALTER TABLE public.diagram_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diagram_invitations FROM anon, authenticated;

-- ─── Helpers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.assert_diagram_owner(p_diagram_id text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.diagrams WHERE id = p_diagram_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;
END;
$$;

-- Marca como 'expired' las pendientes vencidas de un diagrama/email, para que
-- el índice parcial deje crear una nueva.
CREATE OR REPLACE FUNCTION public.expire_stale_invitations(p_diagram_id text, p_email text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  UPDATE public.diagram_invitations
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now()
     AND (p_diagram_id IS NULL OR diagram_id = p_diagram_id)
     AND (p_email IS NULL OR email = p_email);
$$;

-- ─── Owner: crear / listar / revocar / reenviar ─────────────────────────────

CREATE OR REPLACE FUNCTION public.create_diagram_invitation(
    p_diagram_id text, p_email text, p_role text, p_token_hash text)
 RETURNS TABLE(id uuid, email text, role text, status text, expires_at timestamptz, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  PERFORM public.assert_diagram_owner(p_diagram_id);
  IF p_role NOT IN ('editor', 'viewer') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF v_email = public.current_user_email() THEN RAISE EXCEPTION 'cannot_invite_self'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.diagram_shares ds
    JOIN auth.users u ON u.id = ds.shared_with
    WHERE ds.diagram_id = p_diagram_id AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  PERFORM public.expire_stale_invitations(p_diagram_id, v_email);
  IF EXISTS (
    SELECT 1 FROM public.diagram_invitations i
    WHERE i.diagram_id = p_diagram_id AND i.email = v_email AND i.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'invitation_exists';
  END IF;

  RETURN QUERY
  INSERT INTO public.diagram_invitations AS i (diagram_id, email, role, invited_by, token_hash)
  VALUES (p_diagram_id, v_email, p_role, auth.uid(), p_token_hash)
  RETURNING i.id, i.email, i.role, i.status, i.expires_at, i.created_at;

  PERFORM public.log_activity('invitation.create', 'diagram', p_diagram_id,
    jsonb_build_object('email', v_email, 'role', p_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.list_diagram_invitations(p_diagram_id text)
 RETURNS TABLE(id uuid, email text, role text, status text, expires_at timestamptz, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_diagram_owner(p_diagram_id);
  PERFORM public.expire_stale_invitations(p_diagram_id, NULL);
  RETURN QUERY
  SELECT i.id, i.email, i.role, i.status, i.expires_at, i.created_at
    FROM public.diagram_invitations i
   WHERE i.diagram_id = p_diagram_id AND i.status = 'pending'
   ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_diagram_invitation(p_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_diagram_id text;
BEGIN
  SELECT diagram_id INTO v_diagram_id FROM public.diagram_invitations
   WHERE id = p_invitation_id AND status = 'pending';
  IF v_diagram_id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  PERFORM public.assert_diagram_owner(v_diagram_id);
  UPDATE public.diagram_invitations SET status = 'revoked', responded_at = now()
   WHERE id = p_invitation_id;
  PERFORM public.log_activity('invitation.revoke', 'diagram', v_diagram_id,
    jsonb_build_object('invitation_id', p_invitation_id));
END;
$$;

-- Reenviar = revocar la pendiente y crear otra con token nuevo, en una sola
-- transacción (el token anterior deja de servir).
CREATE OR REPLACE FUNCTION public.resend_diagram_invitation(p_invitation_id uuid, p_token_hash text)
 RETURNS TABLE(id uuid, email text, role text, status text, expires_at timestamptz, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_inv public.diagram_invitations;
BEGIN
  SELECT * INTO v_inv FROM public.diagram_invitations i
   WHERE i.id = p_invitation_id AND i.status IN ('pending', 'expired');
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  PERFORM public.assert_diagram_owner(v_inv.diagram_id);
  UPDATE public.diagram_invitations SET status = 'revoked', responded_at = now()
   WHERE diagram_invitations.id = p_invitation_id AND diagram_invitations.status = 'pending';
  RETURN QUERY
  SELECT * FROM public.create_diagram_invitation(v_inv.diagram_id, v_inv.email, v_inv.role, p_token_hash);
END;
$$;

-- ─── Invitado: listar / aceptar / rechazar ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_my_invitations()
 RETURNS TABLE(id uuid, diagram_id text, diagram_name text, role text, expires_at timestamptz,
               created_at timestamptz, invited_by_name text, invited_by_avatar text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_email text := public.current_user_email();
BEGIN
  PERFORM public.expire_stale_invitations(NULL, v_email);
  RETURN QUERY
  SELECT i.id, i.diagram_id, d.name, i.role, i.expires_at, i.created_at,
         up.display_name, up.avatar_url
    FROM public.diagram_invitations i
    JOIN public.diagrams d ON d.id = i.diagram_id
    LEFT JOIN public.user_profiles up ON up.user_id = i.invited_by
   WHERE i.email = v_email AND i.status = 'pending'
   ORDER BY i.created_at DESC;
END;
$$;

-- Acepta por id (desde el Dashboard) o por token (desde el enlace del email).
-- En ambos casos el email de la invitación debe ser el del llamante.
CREATE OR REPLACE FUNCTION public.accept_diagram_invitation(p_invitation_id uuid, p_token_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_inv public.diagram_invitations;
  v_owner uuid;
BEGIN
  SELECT * INTO v_inv FROM public.diagram_invitations i
   WHERE (p_invitation_id IS NOT NULL AND i.id = p_invitation_id)
      OR (p_token_hash IS NOT NULL AND i.token_hash = p_token_hash)
   FOR UPDATE;
  IF v_inv.id IS NULL OR v_inv.status IN ('revoked', 'declined') THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;
  IF v_inv.email <> public.current_user_email() THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;
  IF v_inv.status = 'accepted' THEN
    RETURN v_inv.diagram_id;  -- idempotente: doble clic / reintento
  END IF;
  IF v_inv.status = 'expired' OR v_inv.expires_at <= now() THEN
    UPDATE public.diagram_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  SELECT user_id INTO v_owner FROM public.diagrams WHERE id = v_inv.diagram_id;
  INSERT INTO public.diagram_shares (diagram_id, owner_id, shared_with, role)
  VALUES (v_inv.diagram_id, v_owner, auth.uid(), v_inv.role)
  ON CONFLICT (diagram_id, shared_with) DO NOTHING;

  UPDATE public.diagram_invitations SET status = 'accepted', responded_at = now()
   WHERE id = v_inv.id;
  PERFORM public.log_activity('invitation.accept', 'diagram', v_inv.diagram_id,
    jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role));
  RETURN v_inv.diagram_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_diagram_invitation(p_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.diagram_invitations
     SET status = 'declined', responded_at = now()
   WHERE id = p_invitation_id AND status = 'pending'
     AND email = public.current_user_email();
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
END;
$$;

-- ─── Selector de usuarios del sistema ───────────────────────────────────────
-- Lista para el selector con búsqueda del modal de compartir. Sin texto
-- devuelve los primeros 50 por nombre; con texto filtra por nombre o email
-- (contiene). Excluye al llamante, a los bloqueados y a los miembros actuales.
-- Decisión de producto (2026-09-24): el email se muestra completo, porque la
-- app es interna (registro vía waitlist) y hace falta distinguir personas.
CREATE OR REPLACE FUNCTION public.search_users_for_share(p_diagram_id text, p_query text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
  v_like text;
BEGIN
  PERFORM public.assert_diagram_owner(p_diagram_id);
  v_like := '%' || replace(replace(replace(v_q, '\', '\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT u.id, up.display_name, up.avatar_url, lower(u.email)::text
    FROM auth.users u
    JOIN public.user_profiles up ON up.user_id = u.id
   WHERE u.id <> auth.uid()
     AND NOT up.is_blocked
     AND (v_q = '' OR lower(u.email) LIKE v_like OR lower(coalesce(up.display_name, '')) LIKE v_like)
     AND NOT EXISTS (
       SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = p_diagram_id AND ds.shared_with = u.id)
   ORDER BY coalesce(up.display_name, u.email)
   LIMIT 50;
END;
$$;

-- ─── Compartir directamente con un usuario del sistema ──────────────────────
-- Segunda vía además de la invitación por email: el owner elige a alguien del
-- selector y recibe acceso al instante (la notificación interna la genera el
-- trigger de 2026-09-24-collab-notifications.sql). Si había una invitación por
-- email pendiente para esa persona, queda revocada (sustituida).
CREATE OR REPLACE FUNCTION public.share_diagram_with_user(
    p_diagram_id text, p_user_id uuid, p_role text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_share_id uuid;
  v_email text;
BEGIN
  PERFORM public.assert_diagram_owner(p_diagram_id);
  IF p_role NOT IN ('editor', 'viewer') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_invite_self'; END IF;

  SELECT lower(u.email) INTO v_email
    FROM auth.users u JOIN public.user_profiles up ON up.user_id = u.id
   WHERE u.id = p_user_id AND NOT up.is_blocked;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.diagram_shares
              WHERE diagram_id = p_diagram_id AND shared_with = p_user_id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO public.diagram_shares (diagram_id, owner_id, shared_with, role)
  VALUES (p_diagram_id, auth.uid(), p_user_id, p_role)
  RETURNING id INTO v_share_id;

  UPDATE public.diagram_invitations
     SET status = 'revoked', responded_at = now()
   WHERE diagram_id = p_diagram_id AND email = v_email AND status = 'pending';

  PERFORM public.log_activity('share.create', 'diagram', p_diagram_id,
    jsonb_build_object('shared_with', p_user_id, 'role', p_role));
  RETURN v_share_id;
END;
$$;

-- ─── Permisos de ejecución ──────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION
    public.current_user_email(),
    public.assert_diagram_owner(text),
    public.expire_stale_invitations(text, text),
    public.create_diagram_invitation(text, text, text, text),
    public.list_diagram_invitations(text),
    public.revoke_diagram_invitation(uuid),
    public.resend_diagram_invitation(uuid, text),
    public.list_my_invitations(),
    public.accept_diagram_invitation(uuid, text),
    public.decline_diagram_invitation(uuid),
    public.search_users_for_share(text, text),
    public.share_diagram_with_user(text, uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.create_diagram_invitation(text, text, text, text),
    public.list_diagram_invitations(text),
    public.revoke_diagram_invitation(uuid),
    public.resend_diagram_invitation(uuid, text),
    public.list_my_invitations(),
    public.accept_diagram_invitation(uuid, text),
    public.decline_diagram_invitation(uuid),
    public.search_users_for_share(text, text),
    public.share_diagram_with_user(text, uuid, text)
  TO authenticated;

COMMIT;

-- Rollback:
--   DROP FUNCTION public.share_diagram_with_user(text, uuid, text), public.search_users_for_share(text, text), public.decline_diagram_invitation(uuid),
--     public.accept_diagram_invitation(uuid, text), public.list_my_invitations(),
--     public.resend_diagram_invitation(uuid, text), public.revoke_diagram_invitation(uuid),
--     public.list_diagram_invitations(text), public.create_diagram_invitation(text, text, text, text),
--     public.expire_stale_invitations(text, text), public.assert_diagram_owner(text),
--     public.current_user_email();
--   DROP TABLE public.diagram_invitations;
