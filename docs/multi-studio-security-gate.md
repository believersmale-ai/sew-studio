# Multi-studio security gate — do not enable switching yet

The current database access layer (src/lib/db/client.ts) executes each SQL query
in its own transaction and sets app.user_id for auth.uid(). Existing RLS helpers
in db/migrations/003_functions.sql derive current_shop_id() and current_role()
from profiles, which has one shop_id and role per account.

## Required safe switch implementation
- Introduce a server-validated active shop selector tied to the authenticated
  session; never trust a shop_id supplied by the browser.
- In DbClient.run, set the active shop as a **transaction-local** config value
  alongside app.user_id for every SQL transaction, including all nested queries.
- Change current_shop_id() and current_role() to verify an active, nonremoved
  membership for (auth.uid(), selected shop), and fail closed on missing/removed
  memberships. Never fall back to another studio when selection is invalid.
- Audit every RLS policy and security-definer function, especially policies
  joining profiles, and every service-role API path.
- Move shop-specific profile fields (training, mentor, permissions) to
  membership-linked storage before cross-shop roles are enabled.
- Ensure caches and React Query keys are scoped by active shop, and clear
  client data on switch.
- Enforce membership count and owner-removal constraints in transactions.
- Invitation acceptance must verify the email against the authenticated
  account, validate a single-use unexpired token, and atomically create or
  reactivate only the invited shop membership.
- Test parallel sessions, revoked memberships, and leakage of orders,
  customers, financials, attachments and training data.

## Invitation schema
Migration 052 creates a private table for pending invitations and hashed
tokens only. It deliberately exposes no invitation endpoints or switch action
until the above isolation tests pass.
