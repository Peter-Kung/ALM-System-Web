# ALM System Web

ALM System Web is a private single-user net worth app. It stores editable
accounts, assets, holdings, liabilities, and price records, then turns those
inputs into immutable valuation snapshots for dashboard reporting.

Use this README for local setup and local evaluation. For product behavior
details, start with [docs/index.md](docs/index.md).

## Prerequisites

- Node.js 20 or later
- npm

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
runtime. In development, the app falls back to these credential and session
defaults when you do not set environment variables:

- Username: `owner`
- Password: `change-me`
- Session secret: `development-session-secret-change-me`

You can override them with `APP_USERNAME`, `APP_PASSWORD`, `SESSION_SECRET`,
and `DATABASE_URL`.

## Common commands

- Start the dev server: `npm run dev`
- Run tests: `npm run test`
- Run TypeScript checks: `npm run typecheck`
- Generate Prisma client: `npm run db:generate`
- Apply local Prisma migrations: `npm run db:migrate`

## Sign in

1. Open `http://localhost:3000`.
2. The app redirects protected routes to `/login`.
3. Sign in with the configured credentials.

By default, when `APP_USERNAME` and `APP_PASSWORD` are unset, use:

   - Username: `owner`
   - Password: `change-me`

After a successful sign-in, the app redirects to the dashboard.

## Local usage flow

Use the app in this order so valuation and snapshot features have the data they
need.

### 1. Create accounts

Go to `Accounts` and create the cash and investment accounts you want to track.
Each account stores:

- Name and institution name
- Account type
- Currency
- Current cash balance
- Active status
- Notes

### 2. Create assets

Go to `Assets` and define the instruments that holdings will reference. Each
asset stores:

- Name
- Asset type
- Currency
- Optional symbol
- Price source
- Active status
- Notes

Use `AUTO` pricing for assets that should participate in batch price refresh.
Use `MANUAL` pricing for assets such as funds that need manual price entry.

### 3. Create holdings

Go to `Holdings` and link each asset to an account with a quantity. The page
requires at least one account and one asset before it can create holdings.

### 4. Create liabilities

Go to `Liabilities` and record mortgage or personal loan balances, monthly
payments, dates, and the optional payment account link.

### 5. Add prices

Go to `Prices`.

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
you later edit the live master data.

### 8. Review the dashboard and snapshot history

- `Dashboard` shows the latest saved snapshot summary.
- `Snapshots` shows the saved snapshot list and immutable detail for each run.

If the latest snapshot is incomplete, the dashboard and snapshot history show
that state explicitly instead of treating it as complete.
