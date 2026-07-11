# ALM System Overview

The ALM System is a private multi-user net worth workspace. It stores editable
master data for accounts, holdings, liabilities, and prices per signed-in user,
then turns those inputs into immutable valuation snapshots.

When the database has no users, the app first checks for configured
`APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` values. If they are present, the
app creates that first administrator automatically and normal authentication
continues through `/login`. Those values also support the legacy
fixed-credential upgrade path when the existing owner record still has no
stored password hash. Otherwise, the app allows only the `/setup`
initialization flow. The setup route requires the configured setup token and
creates the first administrator account. After that account exists, the setup
route is no longer available.

`APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` must be configured together. If
only one is set, the app raises a configuration error until the deployment
settings are fixed.

User accounts are stored in the database with password hashes, an active flag,
roles, and a session version. `ADMIN` users can manage users from
`/manage/users`. `USER` users can manage only their own financial workspace
data. The app hides the `Users` navigation entry from non-admin users and
returns `403 Forbidden` from user-management APIs when a non-admin calls them.

Administrators can create users, change roles, activate users, deactivate
users, and request password reset or activation handoffs. Deactivation does not
delete the user's financial records. The app prevents changes that would leave
no active admin.

JWT remains the session mechanism. Every authenticated request validates both
the token signature and current database user state. Password resets and user
deactivation are not implemented the same way in the current product:

- Deactivation increments the user's session version so existing JWT sessions
  stop working immediately.
- Password reset requests currently return a pending self-managed onboarding
  response instead of changing the password directly.

Environment values `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` configure the
bootstrap administrator only for an empty database or the supported legacy
owner-upgrade path. Legacy `APP_USERNAME` and `APP_PASSWORD` remain
compatibility inputs only for upgrade paths from the older fixed-login
single-user model.

The dashboard reports from the latest saved snapshot. It does not recalculate
live market values on page load. This keeps the homepage stable and aligned
with the same saved history used for snapshot review.

The `Trend summary` card shows continuous daily line data for net worth,
assets, liabilities, and monthly debt payments. Each trend point represents a
calendar date. If more than one snapshot exists on the same date, the trend uses
the latest snapshot from that date. If a date has no snapshot, the trend carries
forward the previous known snapshot values, so the line remains flat until the
next saved snapshot.

The trend date controls set the first date in the visible trend window. The
selected date can be any available trend date from the loaded history through
the latest snapshot date. The dashboard loads up to 370 calendar days of trend
history ending at the latest snapshot date. Dates outside the available trend
range are unavailable. The visible window shows up to 10 consecutive dates from
the selected date and stops at the latest snapshot date. Selecting a trend date
changes only the `Trend summary` card; the rest of the dashboard remains based
on the latest saved snapshot.

The dashboard can show amount values in compact `K` notation or full numeric
notation. Compact display is the default Dashboard presentation preference.
This preference does not change saved snapshot values.

Valuation previews use `TWD` as the fixed base currency. When current inputs
require a supported foreign exchange rate, the valuation form can prefill the
rate from a live source before the preview runs. The initial supported live
pair is `USD` to `TWD`.

Prefilled FX rates are still operator-supplied preview inputs. The signed-in
user can edit a prefetched rate or enter a rate manually before running the
preview. Snapshot confirmation saves the rates visible in the confirmed preview;
it does not automatically save an unconfirmed prefilled rate.

Master data remains editable. Snapshot history is immutable. Changing an
account name, asset name, or liability detail later does not rewrite the stored
meaning of an older snapshot. Each user's live data, valuation previews, and
saved snapshots remain isolated from other users.
