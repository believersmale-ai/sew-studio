# Sewsiness Railway migration service

This is a **separate, opt-in migration container**. It must not replace the normal sew-studio app.

## Deploy from Railway
- Connect GitHub repository `believersmale-ai/sew-studio` on branch `fix/railway-migration-idle-start`.
- Set service **Root Directory** to `/railway-migration`.
- Use **Dockerfile** builder (Dockerfile in that root).
- Clear Custom Build Command and Custom Start Command overrides.
- Do not generate a public domain or configure HTTP health checks.
- Default action is `idle`: service stays running and requires **no database variables**.

## Run migration later
- Mount persistent volume at `/data` for backups.
- Set `SOURCE_DATABASE_URL` to the OLD Railway database URL and `TARGET_DATABASE_URL` to a **new empty** PostgreSQL database URL. Store credentials only in Railway Variables.
- Set `MIGRATION_ACTION=inspect`, redeploy and review logs.
- Set `MIGRATION_ACTION=backup`, redeploy, confirm backup and copy it to durable secure storage.
- Only after review: set `MIGRATION_ACTION=restore`, `BACKUP_FILE=/data/<exact-dump-file>`, and `RESTORE_CONFIRM=RESTORE_TO_NEW_EMPTY_DATABASE`, then redeploy.
- **Do not** restore into the existing initialized Postgres service. The script refuses nonempty targets.
- Return to `MIGRATION_ACTION=idle` after any operation to prevent reruns on redeploy.

Do not run `restore` until source/target identity, schema, data integrity, and backup recovery are verified. Railway deploy status does not imply a successful migration.
