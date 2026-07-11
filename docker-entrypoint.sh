#!/bin/sh
set -eu

: "${ALM_STORAGE_ROOT:=/var/lib/alm-system}"
: "${ALM_DATA_DIR:=$ALM_STORAGE_ROOT/data}"
: "${ALM_BACKUP_DIR:=$ALM_STORAGE_ROOT/backups}"
: "${ALM_UPDATE_STATE_DIR:=$ALM_STORAGE_ROOT/update-state}"
: "${ALM_UPLOADS_DIR:=$ALM_STORAGE_ROOT/uploads}"
: "${DATABASE_URL:=file:$ALM_DATA_DIR/alm-system.db}"

if [ "${ALM_REQUIRE_FRESH_POSTGRES_ACKNOWLEDGEMENT:-0}" = "1" ] && [ "${ALM_FRESH_POSTGRES_ACKNOWLEDGED:-0}" != "1" ]; then
  echo "This family PostgreSQL runtime does not migrate existing SQLite deployments automatically." >&2
  echo "Set ALM_FRESH_POSTGRES_ACKNOWLEDGED=1 only after confirming this runtime targets a fresh PostgreSQL install." >&2
  exit 1
fi

export ALM_STORAGE_ROOT
export ALM_DATA_DIR
export ALM_BACKUP_DIR
export ALM_UPDATE_STATE_DIR
export ALM_UPLOADS_DIR
export DATABASE_URL

mkdir -p "$ALM_DATA_DIR" "$ALM_BACKUP_DIR" "$ALM_UPDATE_STATE_DIR" "$ALM_UPLOADS_DIR"

if [ "${ALM_SKIP_PRISMA_MIGRATE:-0}" != "1" ]; then
  npx prisma migrate deploy --schema "${PRISMA_SCHEMA_PATH:-prisma/schema.prisma}"
fi

exec "$@"
