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

  assert.deepEqual(summary.sidebarSummary, {
    hasSnapshot: false,
    snapshotAt: null,
    netWorth: null,
    baseCurrency: null,
    status: null,
    cashPosition: null,
    investmentValue: null,
    totalLiabilities: null,
    accountCount: 0,
    holdingCount: 0,
    reminderLabel: "Run the first valuation preview to populate the workspace pulse.",
  });
  assert.deepEqual(summary.emptyState, {
    actionHref: "/manage/valuation",
  });
  assert.equal(summary.heroSummary, null);
  assert.equal(summary.latestSnapshot, null);
  assert.equal(summary.coverage, null);
  assert.deepEqual(summary.reminders, {
    issueCount: 0,
    visibleMessages: [],
    remainingCount: 0,
  });
  assert.deepEqual(summary.allocation, []);
  assert.deepEqual(summary.liabilityBreakdown, []);
  assert.equal(summary.trend, null);
  assert.deepEqual(summary.trendSeries, []);
  assert.deepEqual(summary.issueMessages, []);
});

test("buildDashboardSummary summarizes the latest snapshot for the homepage", () => {
  const summary = buildDashboardSummary([createSnapshot()]);

  assert.deepEqual(summary.sidebarSummary, {
    hasSnapshot: true,
    snapshotAt: "2026-07-08T00:00:00.000Z",
    netWorth: "800.00",
    baseCurrency: "TWD",
    status: SnapshotStatus.COMPLETE,
    cashPosition: "300.00",
    investmentValue: "900.00",
    totalLiabilities: "400.00",
    accountCount: 1,
    holdingCount: 1,
    reminderLabel: "1 accounts and 1 holdings represented.",
  });
  assert.equal(summary.emptyState, null);
  assert.deepEqual(summary.heroSummary, {
    snapshotAt: "2026-07-08T00:00:00.000Z",
    status: SnapshotStatus.COMPLETE,
    issueCount: 0,
    hasTrend: false,
    netWorthDirection: "positive",
  });
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
  assert.deepEqual(summary.coverage, {
    accountCount: 1,
    holdingCount: 1,
    liabilityCount: 1,
    snapshotAt: "2026-07-08T00:00:00.000Z",
  });
  assert.deepEqual(summary.reminders, {
    issueCount: 0,
    visibleMessages: [],
    remainingCount: 0,
  });
  assert.deepEqual(summary.allocation, [
    { label: "Stock", value: "900.00", shareOfAssets: "75.00" },
    { label: "Cash", value: "300.00", shareOfAssets: "25.00" },
  ]);
  assert.deepEqual(summary.liabilityBreakdown, [
    { label: "Mortgage", value: "400.00", shareOfAssets: "100.00" },
  ]);
  assert.equal(summary.trend, null);
  assert.deepEqual(summary.trendSeries, []);
});

test("buildDashboardSummary shows real estate as its own allocation category", () => {
  const summary = buildDashboardSummary([
    createSnapshot({
      totalAssets: decimal("1500.00"),
      investmentValue: decimal("1200.00"),
      holdings: [
        {
          id: "holding-1",
          snapshotId: "snapshot-1",
          sourceHoldingId: "source-holding-1",
          sourceAccountId: "source-account-1",
          sourceAssetId: "source-asset-1",
          accountName: "Property",
          assetName: "Home",
          assetType: AssetType.REAL_ESTATE,
          symbol: null,
          quantity: decimal("1.00"),
          assetCurrency: "TWD",
          priceAmount: decimal("1200.00"),
          priceCurrency: "TWD",
          priceRecordedAt: new Date("2026-07-08T00:00:00.000Z"),
          fxRateToBase: decimal("1.00"),
          marketValue: decimal("1200.00"),
        },
      ],
    }),
  ]);

  assert.deepEqual(summary.allocation, [
    { label: "Real Estate", value: "1200.00", shareOfAssets: "80.00" },
    { label: "Cash", value: "300.00", shareOfAssets: "20.00" },
  ]);
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
  assert.deepEqual(summary.trendSeries, [
    {
      snapshotAt: "2026-07-01T00:00:00.000Z",
      netWorth: "800.00",
      totalAssets: "1200.00",
      totalLiabilities: "400.00",
    },
    {
      snapshotAt: "2026-07-08T00:00:00.000Z",
      netWorth: "880.00",
      totalAssets: "1300.00",
      totalLiabilities: "420.00",
    },
  ]);
  assert.deepEqual(summary.issueMessages, [
    "Missing valid price record for Global Fund.",
  ]);
  assert.deepEqual(summary.reminders, {
    issueCount: 1,
    visibleMessages: ["Missing valid price record for Global Fund."],
    remainingCount: 0,
  });
  assert.deepEqual(summary.heroSummary, {
    snapshotAt: "2026-07-08T00:00:00.000Z",
    status: SnapshotStatus.INCOMPLETE,
    issueCount: 1,
    hasTrend: true,
    netWorthDirection: "positive",
  });
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
  assert.deepEqual(summary.reminders, {
    issueCount: 3,
    visibleMessages: [
      "Error reminder.",
      "Warning reminder.",
      "Information-only reminder.",
    ],
    remainingCount: 0,
  });
});

test("buildDashboardSummary uses a net-worth-aware hero message when the latest snapshot is complete", () => {
  const summary = buildDashboardSummary([
    createSnapshot({
      totalAssets: decimal("300.00"),
      totalLiabilities: decimal("500.00"),
      netWorth: decimal("-200.00"),
    }),
  ]);

  assert.equal(
    summary.heroSummary?.netWorthDirection,
    "negative",
  );
});

test("buildDashboardSummary marks complete snapshots with history as trend-ready", () => {
  const summary = buildDashboardSummary([
    createSnapshot(),
    createSnapshot({
      id: "snapshot-0",
      snapshotAt: new Date("2026-07-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    }),
  ]);

  assert.equal(summary.heroSummary?.hasTrend, true);
});
