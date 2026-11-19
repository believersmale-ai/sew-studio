# Multi-studio membership rollout

## Phase 1 (this PR)
- Add `studio_memberships`, unique per (user_id, shop_id).
- Backfill existing profile roles and permissions without changing `profiles`.
- Only authenticated users can read their own membership rows. No direct client writes.
- No studio switcher or multi-studio invitations are enabled yet. Existing session and RLS stay on legacy `profiles.shop_id`, preventing a partial security migration.

## Required before enabling multi-studio access
1. Introduce a verified active-studio selection in the signed session, with membership checked on every request and immediately after removal.
2. Update `current_shop_id()`, `current_role()`, and all existing RLS policies/functions and API routes to resolve the active membership. Check service-role paths and caches separately.
3. Move training/mentor/permissions and other shop-specific profile fields to membership-linked tables where needed, retaining original user IDs and historical records.
4. Add secure, expiring, single-use invitations, with email verification and atomic acceptance for existing/new users.
5. Update plan limits to count active memberships per shop, not unique global accounts.
6. Verify no cross-shop data leakage (orders, customers, prices, finance, attachments, background jobs), revocation, role switching, and multiple-owner cases.
7. Review freelancer identity model, which currently has a separate `freelancer_profiles` table, before unifying sign-in.

## Migration check
- Apply 051 after prior migrations, in a staging database first.
- Check `SELECT COUNT(*) FROM profiles` against memberships backfilled for the same `(user_id,shop_id)` pairs.
- Confirm that removed profiles become removed memberships.
- Do not enable invitation or switching UI until RLS isolation tests pass.
