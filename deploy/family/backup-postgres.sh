#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
backup_dir="${ALM_FAMILY_BACKUP_DIR:-${script_dir}/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${backup_dir}/alm-system-${timestamp}.dump"

compose_bin=()
if docker compose version >/dev/null 2>&1; then
  compose_bin=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_bin=(docker-compose)
else
  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
fi

mkdir -p "$backup_dir"
chmod 0700 "$backup_dir"

(
  cd "$script_dir"
  "${compose_bin[@]}" exec -T postgres \
    sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
) >"$backup_path"

chmod 0600 "$backup_path"
echo "Created PostgreSQL backup at ${backup_path}"
