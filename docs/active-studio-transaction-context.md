# Active studio transaction context

This change prepares (but does not enable) multi-studio switching.

- AuthApi.lookupActiveShopId resolves the session's selected studio only if
  the session is valid, the account is not banned, membership is active and
  the studio is not suspended.
- AppClient checks the selection again before every authenticated SQL query,
  so removal or suspension invalidates the selection on the next query.
- DbClient sets app.active_shop_id using a transaction-local Postgres setting
  and resets it to an empty value for sessions without a valid selection.
- The selected studio is not accepted from a URL, header, request body or
  browser storage.
- Existing RLS still uses profiles.shop_id; this PR does not permit switching.

Before switching is enabled, migrate every RLS helper and policy that uses
profiles.shop_id/role, update app authorization and tenant-scoped caches,
and add integration tests with two studios and a user holding different roles.
In particular verify isolation of customers, orders, prices, invoices, media
and training data, and immediate removal behavior.

Migration 053 must be applied before deploying this code.
