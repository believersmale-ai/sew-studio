# Rollout gate: membership authorization guard

This is a transitional safeguard, NOT studio switching.

- getTenant() rejects a selected studio different from the legacy profile shop.
- getTenant() rejects missing or removed memberships, even if a stale profile
  still appears active.
- The legacy profile remains authoritative for roles until all role-management
  writes have been migrated. Do not enable cross-studio selection yet.

## Deployment dependencies
- Migration 051 must be applied and its backfill verified before deploying.
- All legacy profile creation paths must create matching memberships.
- Existing staff removal and reactivation paths must update both legacy
  profiles and memberships. Otherwise this guard may deny legitimate users.
- Migration 053 must be applied for active shop lookup.
- Validate login for owner, worker, trainer and trainee, new account creation,
  member removal, reactivation, and role change in staging.
- Test sessions whose selected shop differs from the legacy profile shop:
  they must receive 401 and must never inherit the legacy role.
- Existing RLS still uses profiles.shop_id. No multi-studio switching is enabled.
