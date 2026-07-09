---
name: alm-system-install
description: Explains how to install, start, and remove ALM System Web from an existing local checkout. Use when the user asks for local setup, startup, sign-in defaults, or removal guidance for this repository.
---

# ALM System Web Install Guidance

## Purpose

Provide guidance only. Do not run commands, edit files, or assume the repo must
be cloned first.

## Primary source

Use [README.md](../../README.md) as the primary source of truth for local
installation and startup steps.

Only use other repository files when the README does not answer a relevant
question.

## What to cover

When the user asks how to install or start the app from an existing local
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

## Removal guidance

If the user asks how to remove the app from a local machine, explain that there
is no separate uninstall flow for this repository. Removing the local project
folder is enough.

## Response rules

- Keep the answer focused on local setup, startup, sign-in, and removal.
- Do not add clone steps unless the user explicitly asks for them.
- Do not invent deployment, production, or multi-user guidance.
- If the README and repo disagree, say what the README states first and note the
  mismatch clearly.
