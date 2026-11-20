#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ACTION="${MIGRATION_ACTION:-idle}"
if [[ "$ACTION" == "idle" ]]; then
  echo "Sewsiness migration service ready. No database operation selected."
  exec sleep infinity
fi

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL in Railway Variables}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL in Railway Variables}"
if [[ "$SOURCE_DATABASE_URL" == "$TARGET_DATABASE_URL" ]]; then
  echo "ERROR: source and target URLs are identical" >&2
  exit 2
fi

DIR="${BACKUP_DIR:-/data}"
mkdir -p "$DIR"

check_conn() {
  local name="$1" url="$2"
  echo "Checking $name connectivity (connection strings are never printed)..."
  psql -X -v ON_ERROR_STOP=1 -At -d "$url" -c 'select current_database(), current_user;'
}
check_conn SOURCE "$SOURCE_DATABASE_URL"
check_conn TARGET "$TARGET_DATABASE_URL"

source_id="$(psql -X -v ON_ERROR_STOP=1 -At -d "$SOURCE_DATABASE_URL" -c "select (select system_identifier from pg_control_system())::text || ':' || current_database();")"
target_id="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TARGET_DATABASE_URL" -c "select (select system_identifier from pg_control_system())::text || ':' || current_database();")"
if [[ "$source_id" == "$target_id" ]]; then
  echo "ERROR: source and target identify the same PostgreSQL cluster/database" >&2
  exit 2
fi

check_target_empty() {
  local n
  n="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TARGET_DATABASE_URL" -c "select count(*) from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema');")"
  echo "Target non-system table count: $n"
  if [[ "$n" != 0 ]]; then
    echo "REFUSING RESTORE: target contains tables. Use a NEW EMPTY PostgreSQL service. No changes made." >&2
    exit 3
  fi
}

case "$ACTION" in
  inspect)
    echo "Source counts (estimates only):"
    psql -X -v ON_ERROR_STOP=1 -d "$SOURCE_DATABASE_URL" -c "select schemaname, relname as table_name, n_live_tup as estimated_rows from pg_stat_user_tables where (schemaname,relname) in (('auth','users'),('private','credentials'),('public','shops'),('public','profiles'),('public','freelancer_profiles')) order by 1,2;"
    echo "Target schema inspection:"
    psql -X -v ON_ERROR_STOP=1 -d "$TARGET_DATABASE_URL" -c "select schemaname, count(*) as table_count from pg_tables where schemaname not in ('pg_catalog','information_schema') group by schemaname order by schemaname;"
    echo "INSPECTION COMPLETE: no database modifications."
    ;;
  backup)
    timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
    file="$DIR/sewsiness-$timestamp.dump"
    echo "Creating source backup..."
    pg_dump --format=custom --no-owner --no-acl --file="$file" "$SOURCE_DATABASE_URL"
    pg_restore --list "$file" > "$file.manifest"
    sha256sum "$file" > "$file.sha256"
    echo "Backup created at $file; copy it to secure off-service storage before cutover."
    echo "BACKUP COMPLETE: no database modifications."
    ;;
  restore)
    check_target_empty
    [[ "${RESTORE_CONFIRM:-}" == "RESTORE_TO_NEW_EMPTY_DATABASE" ]] || { echo "Set RESTORE_CONFIRM=RESTORE_TO_NEW_EMPTY_DATABASE to approve restore" >&2; exit 4; }
    file="${BACKUP_FILE:-}"
    [[ -n "$file" && -f "$file" ]] || { echo "BACKUP_FILE must point to an existing dump on persistent storage" >&2; exit 4; }
    echo "Restoring backup into confirmed empty target..."
    pg_restore --exit-on-error --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" "$file"
    echo "RESTORE COMPLETE. Validate accounts and relationships before cutover."
    ;;
  *)
    echo "MIGRATION_ACTION must be idle, inspect, backup, or restore" >&2
    exit 2
    ;;
esac
