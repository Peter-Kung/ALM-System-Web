# ALM System Web

ALM System Web is a private multi-user net worth app. It stores editable
accounts, assets, holdings, liabilities, and price records per signed-in user,
then turns those inputs into immutable valuation snapshots for dashboard
reporting.

Use this README to choose an installation path. For product behavior details
and the full documentation index, start with [docs/index.md](docs/index.md).

## Installation paths

- Use [Local setup](#local-setup) when you want to run the app from this source
  checkout for development or local evaluation.
- Use [Docker Compose deployment](docs/deployment.md) when you want to run the
  supported single-host self-hosted deployment from the published Docker image.

The local setup path uses Node.js, npm, Prisma, and a local SQLite database in
the checkout. The Docker path uses the installer under `deploy/`, writes
runtime files under the deployment root, and manages the application container
with Docker Compose.

## Prerequisites

- Node.js 20 or later
- npm

These prerequisites apply to local setup. Docker deployment requirements are
listed in [Docker Compose deployment](docs/deployment.md#requirements).

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env` file for Prisma and app startup:

   ```dotenv
   DATABASE_URL="file:./prisma/dev.db"
   ```

3. Generate the Prisma client:

   ```bash
   npm run db:generate
   ```

4. Create or update the local SQLite database:

   ```bash
   npm run db:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

This repo requires `DATABASE_URL` to be set for Prisma commands and app
runtime. In development, the app falls back to these defaults when you do not
set environment variables:

- Setup token: `setup-token`
- Legacy fixed username: `owner`
- Legacy fixed password: `change-me`
- Session secret: `development-session-secret-change-me`

You can override bootstrap and runtime configuration with:

- `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` for the configured first admin
- `APP_SETUP_TOKEN` for the one-time setup route
- `SESSION_SECRET` and `DATABASE_URL` for runtime configuration

Set `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` together. If only one is set,
the app raises a configuration error instead of falling back to setup.

If `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` are set and the database has
no users yet, the app creates that first administrator before normal sign-in.
Those values also support the legacy fixed-credential upgrade path when the
existing owner record still has no stored password hash. In other cases, use
the existing database-backed accounts as-is. If no configured administrator is
present and the database still has no users, complete first-run setup at
`/setup` instead.

The legacy `APP_USERNAME` and `APP_PASSWORD` values remain compatibility inputs
only when an existing deployment upgrades from the older fixed-credential
single-user model. After a user has a stored password hash, normal sign-ins
always use the database-backed user credentials.

`npm run db:generate` only updates the local Prisma Client. It does not change
the SQLite database schema. Use `npm run db:migrate` to apply pending Prisma
migrations while preserving existing local data. Do not use
`prisma migrate reset` if you need to keep accounts, assets, holdings,
liabilities, prices, snapshots, or users in the local database.

`npm run dev` also runs `prisma migrate deploy` before the dev server starts, so
an existing local database receives checked-in migrations before the app queries
new columns.

## Self-hosted Docker deployment

The supported Docker deployment is a single-host Docker Compose installation.
It installs the published image, creates the deployment root, persists the
SQLite database and update state outside the image, and exposes the app on
`127.0.0.1:3000` by default.

Follow [Docker Compose deployment](docs/deployment.md) for install, setup,
operations, update, rollback, backup, and removal guidance. Do not use the
local development commands in this README as a substitute for the Docker
deployment flow.

## Common commands

- Start the dev server: `npm run dev`
- Run tests: `npm run test`
- Run TypeScript checks: `npm run typecheck`
- Generate Prisma client: `npm run db:generate`
- Apply local Prisma migrations while preserving data: `npm run db:migrate`

## Sign in

1. Open `http://localhost:3000`.
2. The app redirects protected routes to `/login`.
3. If `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` are configured before the
   first user exists, sign in at `/login` with that administrator account.
4. If no users exist and no configured administrator is bootstrapped, open
   `/setup`, enter the setup token, and create the first administrator account.
5. After setup completes, sign in at `/login` with a database-backed user.

After a successful sign-in, the app redirects to the dashboard.

## Account settings

Every signed-in user can change their own username, password, or both from
`Settings` > `Account`. Administrators also get deployment controls and the
`Users` management area.

Credential changes require the current password. Password changes also require
a matching confirmation value. After a successful credential change, the app
clears the current session and redirects to `/login`. Password changes also
increment the user's session version, so existing JWT sessions become invalid.
Sign in again with the updated username or password.

## User roles and access

- `ADMIN` users can manage users from `/manage/users` and access deployment
  update controls.
- `USER` users can manage only their own financial workspace data.
- The `Users` navigation entry is visible only to `ADMIN` users.
- User-management APIs return `403 Forbidden` to non-admin requests.

Administrators can create users, change roles, activate users, deactivate
users, and request password reset or activation handoffs. Deactivation does not
delete a user's financial data. The app prevents changes that would leave no
active admin.

User deactivation invalidates existing JWT sessions immediately. Password reset
requests currently return a pending self-managed onboarding response rather than
changing the password directly. A deactivated user cannot sign in again until
an administrator reactivates the account.

## Local usage flow

Use the app in this order so valuation and snapshot features have the data they
need.

### 1. Create accounts

Go to `Accounts` and create the cash and investment accounts you want to track.
Each signed-in user sees and edits only their own accounts. Each account
stores:

- Name and institution name
- Account type
- Currency
- Current cash balance
- Active status
- Notes

### 2. Create assets

Go to `Assets` and define the instruments that holdings will reference. Each
signed-in user sees and edits only their own assets. Each asset stores:

- Name
- Asset type
- Currency
- Optional symbol
- Price source
- Active status
- Notes

Use `AUTO` pricing for assets that should participate in batch price refresh.
Use `MANUAL` pricing for assets such as funds or real estate estimates that
need manual price entry. Real estate is a supported asset type; model one
property as a real estate asset with a holding quantity of 1 and a manual price
equal to the current estimate.

### 3. Create holdings

Go to `Holdings` and link each asset to an account with a quantity. The page
requires at least one account and one asset before it can create holdings.
Holdings stay isolated to the signed-in user.

### 4. Create liabilities

Go to `Liabilities` and record mortgage or personal loan balances, monthly
payments, dates, and the optional payment account link. Liabilities stay
isolated to the signed-in user.

### 5. Add prices

Go to `Prices`. Price records stay isolated to the signed-in user.

- Use `Refresh prices` to fetch new records for active auto-priced assets.
- Use the manual price form to save a price for active manual-priced assets.

The price page keeps the latest saved record visible for each asset and can
report partial success for auto refresh.

### 6. Run valuation preview

Go to `Valuation` and run a preview from current master data and latest saved
prices.

The preview shows:

- Total assets, liabilities, and net worth in TWD
- Cash position and investment value
- Liability totals and monthly payment totals
- Per-account, per-holding, and per-liability detail
- Explicit issues when price or FX inputs are missing

### 7. Confirm a snapshot

From the valuation page, use `Confirm snapshot` to save an immutable snapshot.
The saved snapshot keeps the valuation result and its historical labels even if
you later edit the live master data. Snapshots stay isolated to the signed-in
user.

### 8. Review the dashboard and snapshot history

- `Dashboard` shows the latest saved snapshot summary.
- `Snapshots` shows the saved snapshot list and immutable detail for each run.

If the latest snapshot is incomplete, the dashboard and snapshot history show
that state explicitly instead of treating it as complete.
