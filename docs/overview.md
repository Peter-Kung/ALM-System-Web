# ALM System Overview

The ALM System is a private single-user net worth workspace. It stores editable
master data for accounts, holdings, liabilities, and prices, then turns those
inputs into immutable valuation snapshots.

The dashboard reports from the latest saved snapshot. It does not recalculate
live market values on page load. This keeps the homepage stable and aligned
with the same saved history used for snapshot review.

Master data remains editable. Snapshot history is immutable. Changing an
account name, asset name, or liability detail later does not rewrite the stored
meaning of an older snapshot.
