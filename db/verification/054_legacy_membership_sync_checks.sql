-- Run after 054 in staging. All mismatch counts must be zero.
SELECT count(*) AS missing_or_inactive_mismatch
FROM public.profiles p
LEFT JOIN public.studio_memberships m
 ON m.user_id=p.id AND m.shop_id=p.shop_id
WHERE m.id IS NULL OR (m.status='active') IS DISTINCT FROM p.is_active;

SELECT count(*) AS role_or_permission_mismatch
FROM public.profiles p
JOIN public.studio_memberships m
 ON m.user_id=p.id AND m.shop_id=p.shop_id
WHERE m.role IS DISTINCT FROM p.role
 OR m.can_access_orders IS DISTINCT FROM p.can_access_orders
 OR m.can_access_board IS DISTINCT FROM p.can_access_board
 OR m.can_manage_freelancers IS DISTINCT FROM p.can_manage_freelancers;

-- Also test: new studio owner registration, new staff creation, role change,
-- permissions change, remove/reactivate, and session authorization.
