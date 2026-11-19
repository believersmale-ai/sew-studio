-- Run after migration 051 on staging; all checks should return zero.
-- 1. Missing membership for existing profile:
SELECT count(*) AS missing_legacy_memberships
FROM public.profiles p
LEFT JOIN public.studio_memberships m ON m.user_id=p.id AND m.shop_id=p.shop_id
WHERE m.id IS NULL;

-- 2. Incorrect legacy role or permissions:
SELECT count(*) AS mismatched_legacy_memberships
FROM public.profiles p
JOIN public.studio_memberships m ON m.user_id=p.id AND m.shop_id=p.shop_id
WHERE m.role<>p.role
   OR m.can_access_orders IS DISTINCT FROM p.can_access_orders
   OR m.can_access_board IS DISTINCT FROM p.can_access_board
   OR m.can_manage_freelancers IS DISTINCT FROM p.can_manage_freelancers
   OR (m.status='active') IS DISTINCT FROM p.is_active;

-- 3. Duplicate person/studio pairs (also prevented by unique constraint):
SELECT user_id,shop_id,count(*) FROM public.studio_memberships
GROUP BY user_id,shop_id HAVING count(*)>1;
