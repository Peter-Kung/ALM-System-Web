import assert from "node:assert/strict";
import test from "node:test";

import { SnapshotStatus } from "@prisma/client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardPageView } from "@/components/dashboard-page-view";
import type { DashboardSummary } from "@/modules/dashboard/service";

function createDashboardSummary(
  overrides: Partial<DashboardSummary> = {},
): DashboardSummary {
  return {
    latestSnapshot: {
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
      issueCount: 4,
      accountCount: 2,
      holdingCount: 3,
      liabilityCount: 1,
    },
    allocation: [{ label: "Stock", value: "900.00", shareOfAssets: "75.00" }],
    liabilityBreakdown: [
      { label: "Mortgage", value: "400.00", shareOfAssets: "100.00" },
    ],
    trend: {
      previousSnapshotAt: "2026-07-01T00:00:00.000Z",
      netWorthChange: "80.00",
      totalAssetsChange: "100.00",
      totalLiabilitiesChange: "20.00",
      monthlyDebtPaymentChange: "5.00",
    },
    issueMessages: [
      "Missing valid price record for Global Fund.",
      "FX rate for USD is stale.",
      "Cash account balance needs refresh.",
      "Older reminder should be hidden.",
    ],
    ...overrides,
  };
}

test("dashboard page view renders the guided empty state when no snapshot exists", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={{
        latestSnapshot: null,
        allocation: [],
        liabilityBreakdown: [],
        trend: null,
        issueMessages: [],
      }}
    />,
  );

  assert.match(markup, /No saved snapshot yet/);
  assert.match(markup, /Open valuation workspace/);
  assert.doesNotMatch(markup, /Reminders/);
});

test("dashboard page view renders summary-first sections and limits reminders to three items", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView dashboard={createDashboardSummary()} />,
  );

  assert.match(markup, /Freshness/);
  assert.match(markup, /Net worth/);
  assert.match(markup, /Cash position/);
  assert.match(markup, /Investment value/);
  assert.match(markup, /Debt pressure/);
  assert.match(markup, /Reminders/);
  assert.match(markup, /Coverage/);
  assert.match(markup, /The latest snapshot is usable, but reminder items still need follow-up\./);
  assert.match(markup, /Missing valid price record for Global Fund\./);
  assert.match(markup, /FX rate for USD is stale\./);
  assert.match(markup, /Cash account balance needs refresh\./);
  assert.doesNotMatch(markup, /Older reminder should be hidden\./);
});
