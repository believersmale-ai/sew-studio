## Safe startup (no variables required)

The default `MIGRATION_ACTION=idle` keeps the service running without connecting to either database. No Custom Start Command is needed; clear any prior override in Railway. To run a database operation, configure secure Railway variables and explicitly select `inspect`, `backup`, or `restore`. The restore action requires an empty target and confirmation. Do not expose credentials in GitHub.

# Sewsiness — Railway-native PostgreSQL transfer worker

**Safe by default.** The service starts in `inspect` mode. It never deletes tables. Restore is blocked unless the target has **zero non-system tables** and you explicitly confirm. The existing NEW Railway database shown in screenshots has 71 tables, so it **cannot be the restore target**.

## Setup
1. Keep the old production database untouched. Create a **third, fresh, empty PostgreSQL service** for the restored copy in Railway. Do not point the worker at the currently initialized 71-table database.
2. Add this folder to a GitHub repository you control. Deploy it as a **temporary separate Railway service** using the included Dockerfile (set the service root directory to this folder, or make its contents the repository root). Do **not** replace the normal Sewsiness web app's start command.
3. Add a **persistent Railway volume mounted at `/data`** to this migration service before making backups. Backups in the container without a volume can disappear on redeploy. Securely copy backups off Railway for durable recovery.
4. Set `SOURCE_DATABASE_URL` to the OLD Railway PostgreSQL connection string and `TARGET_DATABASE_URL` to the **fresh empty** database's connection string. Use Railway variable references where supported. When projects differ, a private hostname may not resolve across projects; use the external connection URL with TLS as required. Never commit secrets or paste them in chat.
5. Set `MIGRATION_ACTION=inspect`, deploy, and read logs. Check database identities carefully; both databases may be named `railway` and use user `postgres`, so use Railway service identities as well.
6. Change to `MIGRATION_ACTION=backup` and redeploy the worker. It writes `/data/sewsiness-<timestamp>.dump` and a manifest. **Do not proceed until you have a verified recoverable backup** (ideally copied to separate secure storage).
7. To test restore: set `MIGRATION_ACTION=restore`, `BACKUP_FILE=/data/<exact-backup-filename>.dump`, `RESTORE_CONFIRM=RESTORE_TO_NEW_EMPTY_DATABASE`, and redeploy. Restore only into a **verified empty** target. If the restore fails, stop and investigate; do not retry against a partly restored database.
8. Compare all table row counts and relationships with source; check the application auth schema, especially `auth.users` / `private.credentials` vs `public.app_credentials`, before routing the new app to this restored DB.
9. For final cutover, stop writes/background jobs on the old deployment, take a **fresh final backup**, restore to a new empty target, verify, then update the new web app's `DATABASE_URL` and other auth/storage/payment variables. Do not run two writable deployments against diverging databases.

## Safety / limitations
- **No backup or migration has been executed** by preparing this package.
- Database dump covers PostgreSQL data, not external uploads, email providers, payment gateways, or third-party storage.
- Use a PostgreSQL client version compatible with the source and target server. Dockerfile currently uses PostgreSQL 17 tools; check `SHOW server_version;` first. If the source is newer, update the image tag before backup.
- `pg_control_system()` can require permissions depending on PostgreSQL configuration. If inspect fails with permissions error, stop and request an adjusted identity check; do not remove identity safety checks casually.
- `pg_restore` may need extension/ownership privileges. Review failures rather than applying destructive options.
- Avoid leaving `RESTORE_CONFIRM` set after the test; reset to `inspect` and remove the confirmation variable.
- This is a **one-shot migration worker**, not a scheduled job. It exits after each action; Railway may show the service as stopped/completed. Configure restart policy to never restart automatically for this temporary worker.
