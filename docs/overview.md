# ALM System Overview

The ALM System is a private single-user net worth workspace. It stores editable
master data for accounts, holdings, liabilities, and prices, then turns those
inputs into immutable valuation snapshots.

The signed-in owner manages the workspace account from Settings. The owner can
change the username or password without adding users or changing the
single-user product boundary. After a credential change, the app clears the
current session and requires sign-in with the updated credentials. Environment
values such as `APP_USERNAME` and `APP_PASSWORD` are compatibility inputs for
initialization or upgrade when no stored password hash exists yet.

The dashboard reports from the latest saved snapshot. It does not recalculate
live market values on page load. This keeps the homepage stable and aligned
with the same saved history used for snapshot review.

The dashboard can show amount values in compact `K` notation or full numeric
notation. Compact display is the default Dashboard presentation preference.
This preference does not change saved snapshot values.

Valuation previews use `TWD` as the fixed base currency. When current inputs
require a supported foreign exchange rate, the valuation form can prefill the
rate from a live source before the preview runs. The initial supported live
pair is `USD` to `TWD`.

Prefilled FX rates are still operator-supplied preview inputs. The signed-in
owner can edit a prefetched rate or enter a rate manually before running the
preview. Snapshot confirmation saves the rates visible in the confirmed preview;
it does not automatically save an unconfirmed prefilled rate.

Master data remains editable. Snapshot history is immutable. Changing an
account name, asset name, or liability detail later does not rewrite the stored
meaning of an older snapshot.
