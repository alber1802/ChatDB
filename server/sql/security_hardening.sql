# SQL hardening applied during backend rollout (reference copy)
# Project: yburqxpgzcymdyolbiqg

-- 1) Dedicated fail-closed connection role
-- CREATE ROLE app_backend LOGIN PASSWORD '***' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
-- GRANT CONNECT ON DATABASE postgres TO app_backend;
-- GRANT USAGE ON SCHEMA public, auth TO app_backend;
-- GRANT anon, authenticated TO app_backend;

-- 2) Revoke anon execute on sensitive SECURITY DEFINER RPCs
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.block_user_by_email(text) FROM anon;

GRANT EXECUTE ON FUNCTION public.check_user_blocked_by_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, text) TO authenticated;
