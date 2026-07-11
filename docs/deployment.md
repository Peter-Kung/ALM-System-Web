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
| `update.sh` | Host-side update, rollback, and update-status command. |
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

## Update

Use the host update command from the deployment root:

```bash
cd /opt/alm-system
sudo ./update.sh update
```

By default, the command updates to
`ghcr.io/peter-kung/alm-system-web:latest`. To update to a specific published
image tag, pass the full image name:

```bash
cd /opt/alm-system
sudo ./update.sh update ghcr.io/peter-kung/alm-system-web:sha-<commit-sha>
```

The update command performs these steps:

1. Reads the current image and HTTP settings from `.env`.
2. Creates a SQLite database backup under `backups/` when the database exists.
3. Records `running` update state under `update-state/last-update.json`.
4. Updates `ALM_IMAGE` in `.env`.
5. Pulls the target image and recreates the application container with Docker
   Compose.
6. Lets the container entrypoint run database migrations.
7. Validates the updated app with `/api/health`.

When validation succeeds, `update-state/last-update.json` records `succeeded`,
the previous image, the target image, the active image, the backup path, and the
update time.

## Administrator update UI

Administrators can also inspect and start deployment operations from
**Settings > Version and updates** in the authenticated app.

The app reads:

- The current running image from `ALM_IMAGE`.
- The update target from `ALM_UPDATE_TARGET_IMAGE`.
- The last update result from `update-state/last-update.json`.
- The last in-app version check time from `update-state/last-check.json`.
- The pending in-app operation request from `update-state/pending-operation.json`.

The **Check updates** action records a new check time and refreshes the displayed
version state. The **Start update** and **Start rollback** actions record a
pending operation request under `update-state/pending-operation.json`.

Run the host-side request processor from the deployment root to execute the
pending operation:

```bash
cd /opt/alm-system
sudo ./update.sh run-request
```

The host-side processor uses the same update and rollback orchestration as the
CLI. The application container does not mount the Docker socket and does not
run Docker commands itself.

To change the image offered by the UI update form by default, edit
`ALM_UPDATE_TARGET_IMAGE` in `.env`, then recreate the app container:

```bash
cd /opt/alm-system
sudo docker compose up -d
```

## Rollback

If image pull, startup, migration, or health validation fails, the update
command automatically restores the previous image, restores the pre-update
SQLite backup when one was created, recreates the container, and validates
health again.

For mutable tags such as `latest`, the update command resolves the currently
running image to an immutable digest before it changes the deployment. A
successful rollback can leave `ALM_IMAGE` in `.env` set to that digest so the
host starts the exact previous image instead of resolving the mutable tag again.

The update state records `rolled_back` when automatic rollback succeeds. It
records `rollback_failed` when the previous image does not become healthy.
Inspect container logs before retrying:

```bash
cd /opt/alm-system
sudo docker compose logs app
```

To manually roll back to the previous image recorded in the last update state
while preserving the current database, run:

```bash
cd /opt/alm-system
sudo ./update.sh rollback
```

Manual rollback does not restore the pre-update database backup by default
because the updated system may have accepted new data after the update
succeeded. To restore the recorded pre-update database backup as a destructive
recovery action, run:

```bash
cd /opt/alm-system
sudo ./update.sh rollback --restore-database
```

To inspect the last update result, run:

```bash
cd /opt/alm-system
sudo ./update.sh status
```

## Back Up Data

The update command stops the app and creates a SQLite database backup under
`backups/` before it starts an update when the database exists. For manual
maintenance or host migration, stop the app before copying the database, then
start it again after the copy succeeds:

```bash
cd /opt/alm-system
sudo docker compose stop app
sudo mkdir -p backups
sudo cp -p data/alm-system.db "backups/alm-system-manual-$(date -u +%Y%m%dT%H%M%SZ).db"
sudo docker compose up -d
```

Also save `.env` with the backup set. It contains deployment configuration and
secrets that are required to restart the same deployment.

## Remove the Deployment

There is no separate uninstall command. To remove a Docker deployment, stop the
container and remove the deployment root after you have copied out any data you
want to keep:

```bash
cd /opt/alm-system
sudo docker compose down
cd /
sudo rm -rf /opt/alm-system
```

If you installed to a custom root, replace `/opt/alm-system` with that path. The
removal command deletes the SQLite database, backups, update state, uploads, and
deployment secrets in that root.
