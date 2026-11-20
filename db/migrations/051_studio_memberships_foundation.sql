-- Phase 1: additive, backwards-compatible multi-studio membership foundation.
-- Existing profiles and single-studio session/RLS stay unchanged until phase 2.
CREATE TABLE IF NOT EXISTS public.studio_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('madam','staff','freelancer','trainee','trainer')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')),
 can_access_orders boolean NOT NULL DEFAULT false,
 can_access_board boolean NOT NULL DEFAULT false,
 can_manage_freelancers boolean NOT NULL DEFAULT false,
 joined_at timestamptz NOT NULL DEFAULT now(),
 removed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,shop_id),
 CONSTRAINT membership_removal_consistent CHECK (
  (status='active' AND removed_at IS NULL) OR (status='removed' AND removed_at IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS studio_memberships_shop_status_idx ON public.studio_memberships(shop_id,status);
CREATE INDEX IF NOT EXISTS studio_memberships_user_status_idx ON public.studio_memberships(user_id,status);
INSERT INTO public.studio_memberships(user_id,shop_id,role,status,can_access_orders,can_access_board,can_manage_freelancers,joined_at,removed_at)
SELECT id,shop_id,role,CASE WHEN is_active THEN 'active' ELSE 'removed' END,
       can_access_orders,can_access_board,can_manage_freelancers,
       created_at,CASE WHEN is_active THEN NULL ELSE COALESCE(removed_at,now()) END
FROM public.profiles
ON CONFLICT(user_id,shop_id) DO NOTHING;
ALTER TABLE public.studio_memberships ENABLE ROW LEVEL SECURITY;
-- Read only one's own membership; writes are performed by verified server-side
-- invitation acceptance / studio owner operations in a later phase.
CREATE POLICY "member reads own memberships" ON public.studio_memberships
 FOR SELECT TO authenticated USING(user_id=auth.uid());
-- No direct authenticated INSERT/UPDATE/DELETE policies: fail closed.
COMMENT ON TABLE public.studio_memberships IS 'Phase-1 additive membership model. Legacy profiles/RLS remain authoritative until secure studio switching migration.';
