import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountType,
  AssetType,
  LiabilityType,
  Prisma,
  SnapshotEntityType,
  SnapshotIssueSeverity,
  SnapshotIssueType,
  SnapshotStatus,
} from "@prisma/client";

import { buildDashboardSummary } from "@/modules/dashboard";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createSnapshot(overrides: Partial<Parameters<typeof buildDashboardSummary>[0][number]> = {}) {
  return {
    id: "snapshot-1",
    userId: "user-1",
    previewHash: null,
    status: SnapshotStatus.COMPLETE,
    baseCurrency: "TWD",
    totalAssets: decimal("1200.00"),
    totalLiabilities: decimal("400.00"),
    netWorth: decimal("800.00"),
    cashPosition: decimal("300.00"),
    investmentValue: decimal("900.00"),
    monthlyDebtPaymentTotal: decimal("120.00"),
    snapshotAt: new Date("2026-07-08T00:00:00.000Z"),
    createdAt: new Date("2026-07-08T00:00:00.000Z"),
    accounts: [
      {
        id: "account-1",
        snapshotId: "snapshot-1",
        sourceAccountId: "source-account-1",
        accountName: "Cash",
        institutionName: "Bank",
        accountType: AccountType.BANK,
        currency: "TWD",
        cashBalance: decimal("300.00"),
        holdingsValue: decimal("0.00"),
        totalValue: decimal("300.00"),
      },
    ],
    holdings: [
      {
        id: "holding-1",
        snapshotId: "snapshot-1",
        sourceHoldingId: "source-holding-1",
        sourceAccountId: "source-account-1",
        sourceAssetId: "source-asset-1",
        accountName: "Brokerage",
        assetName: "TSMC",
        assetType: AssetType.STOCK,
        symbol: "2330.TW",
        quantity: decimal("10.00"),
        assetCurrency: "TWD",
        priceAmount: decimal("90.00"),
        priceCurrency: "TWD",
        priceRecordedAt: new Date("2026-07-08T00:00:00.000Z"),
        fxRateToBase: decimal("1.00"),
        marketValue: decimal("900.00"),
      },
    ],
    liabilities: [
      {
        id: "liability-1",
        snapshotId: "snapshot-1",
        sourceLiabilityId: "source-liability-1",
        liabilityName: "Mortgage",
        liabilityType: LiabilityType.MORTGAGE,
        currency: "TWD",
        currentBalance: decimal("400.00"),
        monthlyPayment: decimal("120.00"),
        fxRateToBase: decimal("1.00"),
        balanceValue: decimal("400.00"),
        monthlyPaymentValue: decimal("120.00"),
        paymentAccountName: "Cash",
      },
    ],
    issues: [],
    ...overrides,
  };
}

test("buildDashboardSummary returns empty dashboard data when no snapshots exist", () => {
  const summary = buildDashboardSummary([]);

  assert.equal(summary.latestSnapshot, null);
  assert.deepEqual(summary.allocation, []);
  assert.deepEqual(summary.liabilityBreakdown, []);
  assert.equal(summary.trend, null);
  assert.deepEqual(summary.issueMessages, []);
});

test("buildDashboardSummary summarizes the latest snapshot for the homepage", () => {
  const summary = buildDashboardSummary([createSnapshot()]);

  assert.deepEqual(summary.latestSnapshot, {
    id: "snapshot-1",
    status: SnapshotStatus.COMPLETE,
    baseCurrency: "TWD",
    totalAssets: "1200.00",
    totalLiabilities: "400.00",
    netWorth: "800.00",
    cashPosition: "300.00",
    investmentValue: "900.00",
    monthlyDebtPaymentTotal: "120.00",
    snapshotAt: "2026-07-08T00:00:00.000Z",
    issueCount: 0,
    accountCount: 1,
    holdingCount: 1,
    liabilityCount: 1,
  });
  assert.deepEqual(summary.allocation, [
    { label: "Stock", value: "900.00", shareOfAssets: "75.00" },
    { label: "Cash", value: "300.00", shareOfAssets: "25.00" },
  ]);
  assert.deepEqual(summary.liabilityBreakdown, [
    { label: "Mortgage", value: "400.00", shareOfAssets: "100.00" },
  ]);
  assert.equal(summary.trend, null);
});

test("buildDashboardSummary reports trend deltas and incomplete issue messages", () => {
  const summary = buildDashboardSummary([
    createSnapshot({
      status: SnapshotStatus.INCOMPLETE,
      totalAssets: decimal("1300.00"),
      totalLiabilities: decimal("420.00"),
      netWorth: decimal("880.00"),
      monthlyDebtPaymentTotal: decimal("125.00"),
      issues: [
        {
          id: "issue-1",
          snapshotId: "snapshot-1",
          severity: SnapshotIssueSeverity.ERROR,
          issueType: SnapshotIssueType.MISSING_PRICE,
          affectedEntityType: SnapshotEntityType.ASSET,
          affectedEntityId: "source-asset-2",
          message: "Missing valid price record for Global Fund.",
        },
      ],
    }),
    createSnapshot({
      id: "snapshot-0",
      totalAssets: decimal("1200.00"),
      totalLiabilities: decimal("400.00"),
      netWorth: decimal("800.00"),
      monthlyDebtPaymentTotal: decimal("120.00"),
      snapshotAt: new Date("2026-07-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    }),
  ]);

  assert.deepEqual(summary.trend, {
    previousSnapshotAt: "2026-07-01T00:00:00.000Z",
    netWorthChange: "80.00",
    totalAssetsChange: "100.00",
    totalLiabilitiesChange: "20.00",
    monthlyDebtPaymentChange: "5.00",
  });
  assert.deepEqual(summary.issueMessages, [
    "Missing valid price record for Global Fund.",
  ]);
});

test("buildDashboardSummary sorts issue messages by severity before dashboard consumers truncate them", () => {
  const summary = buildDashboardSummary([
    createSnapshot({
      status: SnapshotStatus.INCOMPLETE,
      issues: [
        {
          id: "issue-3",
          snapshotId: "snapshot-1",
          severity: SnapshotIssueSeverity.INFO,
          issueType: SnapshotIssueType.MISSING_PRICE,
          affectedEntityType: SnapshotEntityType.ASSET,
          affectedEntityId: "source-asset-3",
          message: "Information-only reminder.",
        },
        {
          id: "issue-2",
          snapshotId: "snapshot-1",
          severity: SnapshotIssueSeverity.WARNING,
          issueType: SnapshotIssueType.MISSING_PRICE,
          affectedEntityType: SnapshotEntityType.ASSET,
          affectedEntityId: "source-asset-2",
          message: "Warning reminder.",
        },
        {
          id: "issue-1",
          snapshotId: "snapshot-1",
          severity: SnapshotIssueSeverity.ERROR,
          issueType: SnapshotIssueType.MISSING_PRICE,
          affectedEntityType: SnapshotEntityType.ASSET,
          affectedEntityId: "source-asset-1",
          message: "Error reminder.",
        },
      ],
    }),
  ]);

  assert.deepEqual(summary.issueMessages, [
    "Error reminder.",
    "Warning reminder.",
    "Information-only reminder.",
  ]);
});
