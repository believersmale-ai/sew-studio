-- Session-scoped studio selection, disabled for live switching until all
-- profile-based RLS and application role checks are migrated.
ALTER TABLE private.sessions
 ADD COLUMN IF NOT EXISTS active_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL;

-- A service-side function used when studio switching is enabled.
-- It does not expose direct write privileges to authenticated clients.
CREATE OR REPLACE FUNCTION private.set_session_active_studio(
 p_session_token_hash text,
 p_user_id uuid,
 p_shop_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
 v_updated integer;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.studio_memberships m
   JOIN public.shops s ON s.id=m.shop_id
   WHERE m.user_id=p_user_id AND m.shop_id=p_shop_id
     AND m.status='active' AND s.suspended_at IS NULL
 ) THEN
   RETURN false;
 END IF;
 UPDATE private.sessions
 SET active_shop_id=p_shop_id
 WHERE token_hash=p_session_token_hash
   AND user_id=p_user_id
   AND expires_at>now();
 GET DIAGNOSTICS v_updated = ROW_COUNT;
 RETURN v_updated=1;
END;
$$;
REVOKE ALL ON FUNCTION private.set_session_active_studio(text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_session_active_studio(text,uuid,uuid) FROM anon, authenticated;

-- This helper is for use by future RLS policies after active shop context
-- is passed transaction-locally by DbClient.run. It never trusts a shop ID
-- unless the signed-in user has an active membership in that shop.
CREATE OR REPLACE FUNCTION public.validated_active_shop_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
 SELECT m.shop_id FROM public.studio_memberships m
 JOIN public.shops s ON s.id=m.shop_id
 WHERE m.user_id=auth.uid()
   AND m.shop_id=NULLIF(current_setting('app.active_shop_id',true),'')::uuid
   AND m.status='active'
   AND s.suspended_at IS NULL
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.validated_active_shop_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validated_active_shop_id() TO authenticated;
