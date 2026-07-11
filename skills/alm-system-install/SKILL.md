---
name: alm-system-install
description: Explains how to install, start, operate, update, roll back, back up, or remove ALM System Web using the documented local checkout or single-host Docker Compose paths.
---

# ALM System Web Install Guidance

## Purpose

Provide guidance only. Do not run commands, edit files, or assume the repo must
be cloned first.

## Primary sources

- Use [README.md](../../README.md) as the primary source of truth for choosing
  between local setup and Docker deployment, and for local installation and
  startup steps.
- Use [docs/deployment.md](../../docs/deployment.md) as the primary source of
  truth for the supported single-host Docker Compose deployment.

Only use other repository files when these docs do not answer a relevant
question.

## What to cover

When the user asks which install path to use, distinguish these supported paths:

- Local checkout setup for development or local evaluation.
- Single-host self-hosted Docker Compose deployment from the published image.

When the user asks how to install or start the app locally from an existing
checkout, explain:

1. Prerequisites from the README.
2. Local setup, including `.env` and `DATABASE_URL`.
3. The documented command order:
   - `npm install`
   - `npm run db:generate`
   - `npm run db:migrate`
   - `npm run dev`
4. How to open the app locally after startup.
5. Default sign-in credentials when they are relevant to the answer.

When the user asks how to install or operate the Docker deployment, explain only
the path documented in `docs/deployment.md`:

1. Requirements for a Linux host with Docker and Docker Compose.
2. The installer command from the deployment guide.
3. Supported environment overrides such as `ALM_DEPLOY_ROOT`,
   `ALM_HTTP_PORT`, `ALM_HTTP_BIND`, `ALM_IMAGE`, and
   `ALM_CONTAINER_NAME`.
4. The deployment root layout and which files are persistent.
5. First-run setup with the setup token printed by the installer.
6. Routine Docker Compose operations from the deployment root.
7. Update, rollback, request processing, status, backup, and removal guidance
   from the deployment guide.

## Removal guidance

If the user asks how to remove a local checkout, explain that there is no
separate uninstall flow for that path. Removing the local project folder is
enough.

If the user asks how to remove a Docker deployment, explain the documented
manual removal flow: stop the container with Docker Compose from the deployment
root, copy out any data that must be kept, then remove the deployment root.

## Response rules

- Keep the answer focused on the documented local setup or documented
  single-host Docker deployment.
- Do not add clone steps unless the user explicitly asks for them.
- Do not invent Kubernetes, multi-host, cloud, generic production, or multi-user
  guidance.
- Do not present Docker installer, update, rollback, backup, or removal
  behavior unless it is documented in `docs/deployment.md`.
- If the README, deployment guide, and repo disagree, say what the relevant
  documentation states first and note the mismatch clearly.
