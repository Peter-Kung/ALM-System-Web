# Install ALM System with Docker Compose

This guide describes the supported single-host deployment for ALM System.
It installs the published Docker image and stores runtime state outside the
container image.

## Requirements

- A Linux host with Docker installed and running.
- The Docker Compose plugin, or the legacy `docker-compose` command.
- Network access to GitHub Container Registry and this repository.
- Permission to create the deployment root. The default root is
  `/opt/alm-system`.

## Install

Run the installer on the target host:

```bash
curl -fsSL https://raw.githubusercontent.com/Peter-Kung/ALM-System-Web/main/deploy/install.sh | sudo bash
```

The installer uses these defaults:

- Deployment root: `/opt/alm-system`
- HTTP bind address and port: `127.0.0.1:3000`
- Image: `ghcr.io/peter-kung/alm-system-web:latest`
- Container name: `alm-system`

Set environment variables before the command to change those values:

```bash
curl -fsSL https://raw.githubusercontent.com/Peter-Kung/ALM-System-Web/main/deploy/install.sh \
  | sudo env ALM_DEPLOY_ROOT=/srv/alm-system ALM_HTTP_PORT=8080 bash
```

The default bind address is loopback. Put a TLS-terminating reverse proxy in
front of the app before exposing it to another host. To publish the container on
all host interfaces, set `ALM_HTTP_BIND=0.0.0.0` only after the host has the
required network controls.

When the install succeeds, open the setup page shown by the installer and enter
the printed setup token. The setup flow creates the first administrator account.
After that account exists, the setup page redirects to normal authentication.

## Persistent Files

The installer creates this host directory layout:

```text
/opt/alm-system/
  .env
  docker-compose.yml
  data/
  backups/
  update-state/
  uploads/
```

The `.env` file contains deployment configuration and secrets. The installer
creates it only when it does not already exist.

The installer restricts the deployment root and persistent directories to the
installing user with `0700` permissions. Keep those directories private because
they contain the SQLite database, generated secrets, backups, and future
uploaded files.

| Path | Purpose |
| --- | --- |
| `.env` | Runtime settings, setup token, session secret, image, port, and container name. |
| `docker-compose.yml` | Compose definition for the single application container. |
| `data/` | SQLite database storage. |
| `backups/` | Database backups created before future update operations. |
| `update-state/` | Update state and failure details for future update operations. |
| `uploads/` | Reserved persistent file storage. |

The container mounts these directories under `/var/lib/alm-system`. The
application uses `/var/lib/alm-system/data/alm-system.db` as the production
SQLite database.

## Operate the Deployment

Run Docker Compose commands from the deployment root:

```bash
cd /opt/alm-system
sudo docker compose ps
sudo docker compose logs app
sudo docker compose up -d
sudo docker compose down
```

If your host uses the legacy command, replace `docker compose` with
`docker-compose`.

The health endpoint is available at:

```text
http://127.0.0.1:3000/api/health
```

Change the bind address or port by editing `ALM_HTTP_BIND` or `ALM_HTTP_PORT` in
`.env`, then run:

```bash
cd /opt/alm-system
sudo docker compose up -d
```
