-- Transitional bridge: legacy profile writes keep their own studio
-- membership synchronized until all membership-aware routes are migrated.
-- This does NOT grant access to a second studio or enable switching.
CREATE OR REPLACE FUNCTION public.sync_legacy_profile_membership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.studio_memberships
    (user_id, shop_id, role, status, removed_at,
     can_access_orders, can_access_board, can_manage_freelancers)
  VALUES
    (NEW.id, NEW.shop_id, NEW.role,
     CASE WHEN NEW.is_active THEN 'active' ELSE 'removed' END,
     CASE WHEN NEW.is_active THEN NULL ELSE COALESCE(NEW.removed_at,now()) END,
     COALESCE(NEW.can_access_orders,false),
     COALESCE(NEW.can_access_board,false),
     COALESCE(NEW.can_manage_freelancers,false))
  ON CONFLICT (user_id,shop_id) DO UPDATE SET
    role=EXCLUDED.role,
    status=EXCLUDED.status,
    removed_at=EXCLUDED.removed_at,
    can_access_orders=EXCLUDED.can_access_orders,
    can_access_board=EXCLUDED.can_access_board,
    can_manage_freelancers=EXCLUDED.can_manage_freelancers,
    updated_at=now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_profile_membership_trigger ON public.profiles;
CREATE TRIGGER sync_legacy_profile_membership_trigger
AFTER INSERT OR UPDATE OF shop_id,role,is_active,removed_at,
 can_access_orders,can_access_board,can_manage_freelancers
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_profile_membership();

-- Repair rows that may have been created or modified since migration 051.
-- An update fires the same trigger without changing business data.
UPDATE public.profiles SET role=role;

REVOKE ALL ON FUNCTION public.sync_legacy_profile_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_legacy_profile_membership() FROM anon, authenticated;
