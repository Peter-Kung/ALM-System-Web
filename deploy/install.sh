#!/usr/bin/env bash
set -euo pipefail
umask 077

deploy_root="${ALM_DEPLOY_ROOT:-/opt/alm-system}"
http_port="${ALM_HTTP_PORT:-3000}"
http_bind="${ALM_HTTP_BIND:-127.0.0.1}"
image="${ALM_IMAGE:-ghcr.io/peter-kung/alm-system-web:latest}"
container_name="${ALM_CONTAINER_NAME:-alm-system}"
source_base="${ALM_INSTALL_SOURCE_BASE:-https://raw.githubusercontent.com/Peter-Kung/ALM-System-Web/main/deploy}"
script_source="${BASH_SOURCE[0]:-}"
script_dir=""

if [ -n "$script_source" ]; then
  script_dir="$(cd -- "$(dirname -- "$script_source")" >/dev/null 2>&1 && pwd -P)"
fi

compose_bin=()
if docker compose version >/dev/null 2>&1; then
  compose_bin=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_bin=(docker-compose)
else
  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or the current user cannot access the Docker daemon." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to download deployment files and verify health." >&2
  exit 1
fi

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
    return
  fi

  head -c 48 /dev/urandom | base64 | tr -d '\n'
}

install_compose_template() {
  local destination="$1"
  local local_template="${script_dir}/docker-compose.yml"
  local temp_template

  if [ -n "$script_dir" ] && [ -f "$local_template" ]; then
    temp_template="$(mktemp "${destination}.tmp.XXXXXX")"
    install -m 0644 "$local_template" "$temp_template"
  else
    temp_template="$(mktemp "${destination}.tmp.XXXXXX")"
    if ! curl -fsSL "${source_base}/docker-compose.yml" -o "$temp_template"; then
      rm -f "$temp_template"
      return 1
    fi
  fi

  if ! (
    cd "$(dirname -- "$destination")"
    "${compose_bin[@]}" -f "$temp_template" config >/dev/null
  ); then
    rm -f "$temp_template"
    echo "Downloaded Docker Compose template is not valid." >&2
    exit 1
  fi

  mv "$temp_template" "$destination"
}

install_update_script() {
  local destination="$1"
  local local_script="${script_dir}/update.sh"
  local temp_script

  if [ -n "$script_dir" ] && [ -f "$local_script" ]; then
    temp_script="$(mktemp "${destination}.tmp.XXXXXX")"
    install -m 0755 "$local_script" "$temp_script"
  else
    temp_script="$(mktemp "${destination}.tmp.XXXXXX")"
    if ! curl -fsSL "${source_base}/update.sh" -o "$temp_script"; then
      rm -f "$temp_script"
      return 1
    fi
    chmod 0755 "$temp_script"
  fi

  if ! bash -n "$temp_script"; then
    rm -f "$temp_script"
    echo "Downloaded update script is not valid." >&2
    exit 1
  fi

  mv "$temp_script" "$destination"
}

mkdir -p "$deploy_root"/{data,backups,update-state,uploads}
chmod 0700 "$deploy_root" "$deploy_root"/{data,backups,update-state,uploads}

if [ ! -f "${deploy_root}/.env" ]; then
  session_secret="$(random_secret)"
  setup_token="$(random_secret)"

  cat >"${deploy_root}/.env" <<EOF
APP_NAME=ALM System
APP_SETUP_TOKEN=${setup_token}
SESSION_SECRET=${session_secret}
ALM_DEPLOY_ROOT=${deploy_root}
ALM_HTTP_PORT=${http_port}
ALM_HTTP_BIND=${http_bind}
ALM_IMAGE=${image}
ALM_UPDATE_TARGET_IMAGE=${image}
ALM_CONTAINER_NAME=${container_name}
EOF

  chmod 0600 "${deploy_root}/.env"
else
  setup_token="$(awk -F= '$1 == "APP_SETUP_TOKEN" {print substr($0, index($0, "=") + 1)}' "${deploy_root}/.env" | tail -n 1)"
  http_port="$(awk -F= '$1 == "ALM_HTTP_PORT" {print substr($0, index($0, "=") + 1)}' "${deploy_root}/.env" | tail -n 1)"
  http_bind="$(awk -F= '$1 == "ALM_HTTP_BIND" {print substr($0, index($0, "=") + 1)}' "${deploy_root}/.env" | tail -n 1)"
  http_port="${http_port:-3000}"
  http_bind="${http_bind:-127.0.0.1}"
fi

install_compose_template "${deploy_root}/docker-compose.yml"
install_update_script "${deploy_root}/update.sh"

(
  cd "$deploy_root"
  "${compose_bin[@]}" pull
  "${compose_bin[@]}" up -d
)

if [ "$http_bind" = "0.0.0.0" ] || [ "$http_bind" = "::" ]; then
  health_host="127.0.0.1"
else
  health_host="$http_bind"
fi

health_url="http://${health_host}:${http_port}/api/health"
for _ in $(seq 1 60); do
  if curl -fsS "$health_url" >/dev/null; then
    echo "ALM System is running at http://${health_host}:${http_port}"
    echo "Deployment root: ${deploy_root}"
    if [ -n "${setup_token:-}" ]; then
      echo "First-run setup token: ${setup_token}"
      echo "Save this token, then complete setup at http://${health_host}:${http_port}/setup"
    fi
    exit 0
  fi

  sleep 2
done

echo "ALM System started, but health did not become ready at ${health_url}." >&2
echo "Inspect logs with: cd ${deploy_root} && ${compose_bin[*]} logs app" >&2
exit 1
