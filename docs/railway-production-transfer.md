# Sewsiness: Railway PostgreSQL production transfer

**Status: preparation only. No production database has been copied or modified.**

## Goal
Move the existing Sewsiness application and its complete PostgreSQL data to a **new** Railway deployment while retaining active studio owners, staff, freelancers, credential hashes, permissions, orders, payments, inventory, and historical records. Do not filter out inactive accounts from the backup: their references and audit history may be needed.

## Before touching data
1. Keep the original Railway application and PostgreSQL service running.
2. Create a **separate** new Railway project/environment, new PostgreSQL service, and new application service connected to the same reviewed GitHub commit.
3. Record which PostgreSQL service is the source and which is the destination; label them visibly. Never paste passwords or connection URLs into issues, pull requests, chat, or logs.
4. Confirm the destination is **empty and disposable**. If it contains anything important, stop.
5. Install PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) compatible with the source server version, ideally same major version.
6. Stop writes or enable maintenance mode in the **old application** during the final backup/cutover. A trial migration can be performed earlier while writes continue, but it must not be treated as final.
7. Check storage/uploads: database backup does **not** copy external object storage, uploaded files, email provider settings, or external API secrets. Plan those separately.

## One-time full backup and restore (run locally in a secure terminal)
Use the **public/external** connection strings from the two Railway PostgreSQL services when running outside Railway; Railway internal hostnames only resolve within Railway. Set secrets in your terminal, never commit them.

```bash
# Set these securely in your local shell, without echoing them.
# export SOURCE_DATABASE_URL='postgresql://...'
# export TARGET_DATABASE_URL='postgresql://...'
test -n "${SOURCE_DATABASE_URL:-}" && test -n "${TARGET_DATABASE_URL:-}" || { echo 'Missing database URL'; exit 1; }
test "$SOURCE_DATABASE_URL" != "$TARGET_DATABASE_URL" || { echo 'Source and destination URLs must differ'; exit 1; }

# Confirm source and target identities before proceeding.
psql "$SOURCE_DATABASE_URL" -X -Atc "select current_database(), current_user, inet_server_addr(), inet_server_port()"
psql "$TARGET_DATABASE_URL" -X -Atc "select current_database(), current_user, inet_server_addr(), inet_server_port()"
psql "$TARGET_DATABASE_URL" -X -Atc "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
# STOP if the target count is not zero.

# Backup includes schema, data, credentials, and private migration history.
umask 077
pg_dump --format=custom --no-owner --no-acl --file=sewsiness-transfer.dump "$SOURCE_DATABASE_URL"
pg_restore --list sewsiness-transfer.dump > sewsiness-transfer-manifest.txt

# Restore ONLY to the verified new empty database.
pg_restore --exit-on-error --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" sewsiness-transfer.dump
```

**Important:** Do not run `scripts/bootstrap-railway-db.sh` or `npm run db:migrate` on the destination **before** restoring the full backup. The dump includes the existing schema and `private.schema_migrations` history. After restore, run the reviewed application migrations once using the same release as the destination application.

## Read-only account and integrity verification
Run the following on **both** source and target and compare results. This checks the Railway-native authentication tables and account associations.

```sql
select 'shops' as item, count(*) as total from public.shops
union all select 'profiles', count(*) from public.profiles
union all select 'active_profiles', count(*) from public.profiles where is_active is true
union all select 'freelancer_profiles', count(*) from public.freelancer_profiles
union all select 'app_credentials', count(*) from public.app_credentials
union all select 'app_sessions', count(*) from public.app_sessions
union all select 'freelancer_shop_links', count(*) from public.freelancer_shop_links
union all select 'schema_migrations', count(*) from private.schema_migrations
order by item;
```

Also compare counts for **every application table**, not only accounts. Confirm row counts and selected relational joins for studio memberships, orders, payments, and inventory. For additional assurance compare checksums on stable, non-sensitive IDs; never print password hashes or session tokens. Test sign-in with a designated studio owner, staff member, and freelancer in the new environment, verify correct studio isolation, and test basic read/write workflows.

## Application configuration
- In the **new app service**, set `DATABASE_URL` to a Railway reference to the **new** PostgreSQL service, not the old database. For example `${{Postgres.DATABASE_URL}}` when the database service is actually named `Postgres`.
- Preserve relevant auth settings such as `USE_RAILWAY_AUTH`, cookie/session signing secrets, and any required email, payment, and storage configuration. Use Railway secret variables; do not commit values.
- Confirm the new service has the correct public domain, callback/redirect URLs, and health check `/api/health`.
- The repository currently runs migrations in both `railway.json` pre-deploy and the `npm start` script. Confirm the restored migration history is present before starting the app.
- Browser cookies scoped to the old domain will not automatically transfer to a new domain; users may need to sign in again, **without creating new accounts**.

## Final cutover and rollback
1. Take and securely retain a tested backup of the old production database.
2. Put the old app into maintenance/read-only mode; stop background jobs and webhook writers.
3. Take a **new final dump** after writes stop; restore it into a fresh empty target (or reset only a verified disposable test target). Do not assume an earlier test copy is current.
4. Compare table counts and key relationships; smoke-test the new application and sign-ins.
5. Update DNS/custom domain and integrations only when tests pass. Prevent both deployments from accepting writes simultaneously.
6. Monitor errors and business operations. Retain the old database untouched for rollback.
7. If rollback is necessary after writes begin on the new database, **reconcile new writes first**; simply switching back to the old database would lose them.

## Stop conditions
Stop if source and destination cannot be distinguished, the target is not empty, `pg_restore` reports an error, migration history is missing, account counts differ unexpectedly, a login fails, or external files/secrets are unavailable. Never resolve this by deleting production data or creating replacement accounts.
