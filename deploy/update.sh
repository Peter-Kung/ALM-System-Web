#!/usr/bin/env bash
set -euo pipefail
umask 077

deploy_root="${ALM_DEPLOY_ROOT:-/opt/alm-system}"
command="${1:-update}"
if [ "$#" -gt 0 ]; then
  shift
fi

env_file="${deploy_root}/.env"
compose_file="${deploy_root}/docker-compose.yml"
state_dir="${deploy_root}/update-state"
state_file="${state_dir}/last-update.json"
lock_file="${state_dir}/update.lock"
data_dir="${deploy_root}/data"
backup_dir="${deploy_root}/backups"
database_file="${ALM_DATABASE_FILE:-${data_dir}/alm-system.db}"
health_attempts="${ALM_HEALTH_ATTEMPTS:-60}"
health_sleep_seconds="${ALM_HEALTH_SLEEP_SECONDS:-2}"
health_connect_timeout="${ALM_HEALTH_CONNECT_TIMEOUT:-2}"
health_max_time="${ALM_HEALTH_MAX_TIME:-5}"

compose_bin=()
http_port="3000"
http_bind="127.0.0.1"
container_name="alm-system"
current_image="ghcr.io/peter-kung/alm-system-web:latest"

fail() {
  echo "$1" >&2
  exit 1
}

require_deployment() {
  [ -f "$env_file" ] || fail "Missing ${env_file}. Run deploy/install.sh before updating."
  [ -f "$compose_file" ] || fail "Missing ${compose_file}. Run deploy/install.sh before updating."

  mkdir -p "$state_dir" "$backup_dir"
  chmod 0700 "$state_dir" "$backup_dir"
}

acquire_lock() {
  command -v flock >/dev/null 2>&1 || fail "flock is required to serialize update and rollback operations."
  exec 9>"$lock_file"
  if ! flock -n 9; then
    fail "Another ALM System update or rollback is already running."
  fi
}

load_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key {print substr($0, index($0, "=") + 1)}' "$env_file" | tail -n 1
}

load_deployment_config() {
  http_port="$(load_env_value ALM_HTTP_PORT)"
  http_bind="$(load_env_value ALM_HTTP_BIND)"
  container_name="$(load_env_value ALM_CONTAINER_NAME)"
  current_image="$(load_env_value ALM_IMAGE)"

  http_port="${http_port:-3000}"
  http_bind="${http_bind:-127.0.0.1}"
  container_name="${container_name:-alm-system}"
  current_image="${current_image:-ghcr.io/peter-kung/alm-system-web:latest}"
}

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    compose_bin=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    compose_bin=(docker-compose)
  else
    fail "Docker Compose is required. Install the Docker Compose plugin or docker-compose."
  fi
}

require_tools() {
  command -v docker >/dev/null 2>&1 || fail "Docker is required."
  command -v curl >/dev/null 2>&1 || fail "curl is required for health validation."
  docker info >/dev/null 2>&1 || fail "Docker is not running or the current user cannot access the Docker daemon."
  detect_compose
}

validate_health_config() {
  [[ "$health_attempts" =~ ^[1-9][0-9]*$ ]] || fail "ALM_HEALTH_ATTEMPTS must be a positive integer."
  [[ "$health_sleep_seconds" =~ ^[0-9]+$ ]] || fail "ALM_HEALTH_SLEEP_SECONDS must be a non-negative integer."
  [[ "$health_connect_timeout" =~ ^[1-9][0-9]*$ ]] || fail "ALM_HEALTH_CONNECT_TIMEOUT must be a positive integer."
  [[ "$health_max_time" =~ ^[1-9][0-9]*$ ]] || fail "ALM_HEALTH_MAX_TIME must be a positive integer."
}

image_repository() {
  local image="$1"
  local without_digest="${image%%@*}"
  local last_segment="${without_digest##*/}"
  local prefix="${without_digest%/*}"

  if [ "$without_digest" != "$image" ]; then
    printf '%s' "$without_digest"
    return
  fi

  if [ "$last_segment" != "${last_segment%%:*}" ]; then
    if [ "$prefix" = "$without_digest" ]; then
      printf '%s' "${last_segment%%:*}"
    else
      printf '%s/%s' "$prefix" "${last_segment%%:*}"
    fi
    return
  fi

  printf '%s' "$without_digest"
}

current_rollback_image() {
  if [ "$current_image" != "${current_image%%@*}" ]; then
    printf '%s' "$current_image"
    return
  fi

  local container_id
  local image_id
  local repository
  local repo_digest

  repository="$(image_repository "$current_image")"
  container_id="$(
    cd "$deploy_root"
    "${compose_bin[@]}" ps -q app 2>/dev/null | tail -n 1
  )"

  if [ -n "$container_id" ]; then
    image_id="$(docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null || true)"
    if [ -n "$image_id" ]; then
      repo_digest="$(
        docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$image_id" 2>/dev/null \
          | awk -v prefix="${repository}@" 'index($0, prefix) == 1 { print; exit }'
      )"
    fi
  fi

  if [ -z "${repo_digest:-}" ]; then
    repo_digest="$(
      docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$current_image" 2>/dev/null \
        | awk -v prefix="${repository}@" 'index($0, prefix) == 1 { print; exit }'
    )"
  fi

  if [ -z "${repo_digest:-}" ]; then
    echo "Cannot resolve an immutable digest for current image ${current_image}; refusing an update that cannot roll back reliably." >&2
    return 1
  fi

  printf '%s' "$repo_digest"
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

write_state() {
  local status="$1"
  local from_image="$2"
  local target_image="$3"
  local active_image="$4"
  local backup_path="$5"
  local message="$6"
  local updated_at

  updated_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  if ! cat >"${state_file}.tmp" <<EOF
{
  "status": "$(json_escape "$status")",
  "fromImage": "$(json_escape "$from_image")",
  "targetImage": "$(json_escape "$target_image")",
  "activeImage": "$(json_escape "$active_image")",
  "backupPath": "$(json_escape "$backup_path")",
  "message": "$(json_escape "$message")",
  "updatedAt": "$(json_escape "$updated_at")"
}
EOF
  then
    rm -f "${state_file}.tmp"
    return 1
  fi
  if ! mv "${state_file}.tmp" "$state_file"; then
    rm -f "${state_file}.tmp"
    return 1
  fi
  if ! chmod 0600 "$state_file"; then
    return 1
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local temp_file

  temp_file="$(mktemp "${env_file}.tmp.XXXXXX")"
  if awk -F= -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $1 == key {
      print key "=" value
      found = 1
      next
    }
    { print }
    END {
      if (!found) {
        print key "=" value
      }
    }
  ' "$env_file" >"$temp_file"; then
    if ! mv "$temp_file" "$env_file"; then
      rm -f "$temp_file"
      return 1
    fi
    if ! chmod 0600 "$env_file"; then
      return 1
    fi
  else
    rm -f "$temp_file"
    return 1
  fi
}

health_url() {
  local health_host="$http_bind"
  if [ "$health_host" = "0.0.0.0" ] || [ "$health_host" = "::" ]; then
    health_host="127.0.0.1"
  fi

  printf 'http://%s:%s/api/health' "$health_host" "$http_port"
}

wait_for_health() {
  local url
  url="$(health_url)"

  for _ in $(seq 1 "$health_attempts"); do
    if curl --connect-timeout "$health_connect_timeout" --max-time "$health_max_time" -fsS "$url" >/dev/null; then
      return 0
    fi

    sleep "$health_sleep_seconds"
  done

  return 1
}

compose_pull_up() {
  local image="$1"

  (
    cd "$deploy_root"
    if ! ALM_IMAGE="$image" "${compose_bin[@]}" pull app; then
      return 1
    fi
    if ! ALM_IMAGE="$image" "${compose_bin[@]}" up -d app; then
      return 1
    fi
  )
}

compose_up_with_image() {
  local image="$1"

  (
    cd "$deploy_root"
    if ! ALM_IMAGE="$image" "${compose_bin[@]}" up -d app; then
      return 1
    fi
  )
}

compose_stop() {
  (
    cd "$deploy_root"
    if ! "${compose_bin[@]}" stop app; then
      return 1
    fi
  )
}

copy_database_backup() {
  local timestamp="$1"
  local backup_path="${backup_dir}/alm-system-${timestamp}.db"

  if [ -f "$database_file" ]; then
    if ! cp -p "$database_file" "$backup_path"; then
      echo "Failed to create database backup at ${backup_path}." >&2
      return 1
    fi
    if ! chmod 0600 "$backup_path"; then
      echo "Failed to restrict database backup permissions at ${backup_path}." >&2
      return 1
    fi
    printf '%s' "$backup_path"
  else
    printf ''
  fi
}

restore_database_backup() {
  local backup_path="$1"
  local restore_temp

  if [ -n "$backup_path" ] && [ -f "$backup_path" ]; then
    restore_temp="$(mktemp "${database_file}.restore.XXXXXX")"
    if ! cp -p "$backup_path" "$restore_temp"; then
      rm -f "$restore_temp"
      echo "Failed to copy database backup from ${backup_path}." >&2
      return 1
    fi
    if ! chmod 0600 "$restore_temp"; then
      rm -f "$restore_temp"
      echo "Failed to restrict restored database permissions at ${restore_temp}." >&2
      return 1
    fi
    if ! mv "$restore_temp" "$database_file"; then
      rm -f "$restore_temp"
      echo "Failed to replace database with restored backup at ${database_file}." >&2
      return 1
    fi
  fi
}

rollback_to_image() {
  local image="$1"
  local backup_path="$2"

  if ! compose_stop; then
    return 1
  fi
  if ! restore_database_backup "$backup_path"; then
    return 1
  fi
  if ! compose_up_with_image "$image"; then
    return 1
  fi
  if ! wait_for_health; then
    return 1
  fi
  if ! set_env_value ALM_IMAGE "$image"; then
    return 1
  fi
}

read_json_string() {
  local key="$1"
  local file="$2"

  sed -n 's/^[[:space:]]*"'"$key"'"[[:space:]]*:[[:space:]]*"\(.*\)",\{0,1\}[[:space:]]*$/\1/p' "$file" \
    | sed 's/\\"/"/g; s/\\\\/\\/g' \
    | tail -n 1
}

run_update() {
  local target_image="${1:-ghcr.io/peter-kung/alm-system-web:latest}"
  local rollback_image
  local timestamp
  local backup_path

  if ! rollback_image="$(current_rollback_image)"; then
    fail "Unable to prepare a rollback target for ${current_image}."
  fi
  timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
  compose_stop
  if ! backup_path="$(copy_database_backup "$timestamp")"; then
    if compose_up_with_image "$current_image" && wait_for_health; then
      fail "Database backup failed. Existing deployment was restarted; update was not started."
    fi
    fail "Database backup failed. Existing deployment did not restart cleanly; inspect Docker Compose logs."
  fi
  if ! write_state "running" "$rollback_image" "$target_image" "$current_image" "$backup_path" "Update started."; then
    if compose_up_with_image "$current_image" && wait_for_health; then
      fail "Could not write update state. Existing deployment was restarted; update was not started."
    fi
    fail "Could not write update state. Existing deployment did not restart cleanly; inspect Docker Compose logs."
  fi

  if ! set_env_value ALM_IMAGE "$target_image"; then
    if compose_up_with_image "$current_image" && wait_for_health; then
      fail "Could not update ALM_IMAGE. Existing deployment was restarted; update was not started."
    fi
    fail "Could not update ALM_IMAGE. Existing deployment did not restart cleanly; inspect Docker Compose logs."
  fi

  if compose_pull_up "$target_image" && wait_for_health; then
    if ! write_state "succeeded" "$rollback_image" "$target_image" "$target_image" "$backup_path" "Update completed and health validation passed."; then
      echo "Update completed, but update state could not be recorded." >&2
      return 1
    fi
    echo "ALM System updated to ${target_image}."
    return 0
  fi

  local update_error="Update validation failed. Restoring ${rollback_image}."
  echo "$update_error" >&2

  if rollback_to_image "$rollback_image" "$backup_path"; then
    if ! write_state "rolled_back" "$rollback_image" "$target_image" "$rollback_image" "$backup_path" "$update_error"; then
      echo "Rollback completed, but update state could not be recorded." >&2
      return 1
    fi
    echo "Rollback completed. ALM System is running ${rollback_image}." >&2
    return 1
  fi

  if ! write_state "rollback_failed" "$rollback_image" "$target_image" "$target_image" "$backup_path" "Update failed and rollback validation failed. Inspect Docker Compose logs."; then
    echo "Rollback failed, and update state could not be recorded." >&2
  fi
  echo "Rollback validation failed. Inspect logs with: cd ${deploy_root} && ${compose_bin[*]} logs app" >&2
  return 1
}

run_rollback() {
  local restore_database="${1:-}"

  [ -f "$state_file" ] || fail "No update state found at ${state_file}."

  local previous_image
  local backup_path

  previous_image="$(read_json_string fromImage "$state_file")"
  if [ "$restore_database" = "--restore-database" ]; then
    backup_path="$(read_json_string backupPath "$state_file")"
  elif [ -n "$restore_database" ]; then
    fail "Unknown rollback option: ${restore_database}. Use --restore-database to restore the recorded database backup."
  else
    backup_path=""
  fi
  [ -n "$previous_image" ] || fail "Update state does not include a previous image."

  if ! write_state "running" "$previous_image" "$previous_image" "$current_image" "$backup_path" "Rollback started."; then
    fail "Could not write rollback state. Rollback was not started."
  fi
  if rollback_to_image "$previous_image" "$backup_path"; then
    if ! write_state "rolled_back" "$current_image" "$previous_image" "$previous_image" "$backup_path" "Rollback completed and health validation passed."; then
      echo "Rollback completed, but update state could not be recorded." >&2
      return 1
    fi
    echo "ALM System rolled back to ${previous_image}."
    return 0
  fi

  if ! write_state "rollback_failed" "$previous_image" "$previous_image" "$current_image" "$backup_path" "Rollback validation failed. Inspect Docker Compose logs."; then
    echo "Rollback failed, and update state could not be recorded." >&2
  fi
  return 1
}

print_status() {
  if [ -f "$state_file" ]; then
    cat "$state_file"
  else
    echo "No update state has been recorded."
  fi
}

case "$command" in
  update)
    require_deployment
    acquire_lock
    require_tools
    validate_health_config
    load_deployment_config
    run_update "${1:-}"
    ;;
  rollback)
    require_deployment
    acquire_lock
    require_tools
    validate_health_config
    load_deployment_config
    run_rollback "${1:-}"
    ;;
  status)
    require_deployment
    print_status
    ;;
  *)
    cat >&2 <<EOF
Usage:
  ALM_DEPLOY_ROOT=/opt/alm-system $0 update [image]
  ALM_DEPLOY_ROOT=/opt/alm-system $0 rollback [--restore-database]
  ALM_DEPLOY_ROOT=/opt/alm-system $0 status
EOF
    exit 2
    ;;
esac
