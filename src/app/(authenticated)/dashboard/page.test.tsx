import assert from "node:assert/strict";
import test from "node:test";

import { SnapshotStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";

import { createDashboardPage } from "@/app/(authenticated)/dashboard/page-route";
import type { DashboardSummary } from "@/modules/dashboard/service";

function createDashboardSummary(): DashboardSummary {
  return {
    sidebarSummary: {
      hasSnapshot: true,
      snapshotAt: "2026-07-08T00:00:00.000Z",
      netWorth: "800.00",
      baseCurrency: "TWD",
      status: SnapshotStatus.COMPLETE,
      cashPosition: "300.00",
      investmentValue: "900.00",
      totalLiabilities: "400.00",
      accountCount: 2,
      holdingCount: 3,
      reminderLabel: "Missing valid price record for Global Fund.",
    },
    emptyState: null,
    heroSummary: {
      snapshotAt: "2026-07-08T00:00:00.000Z",
      status: SnapshotStatus.COMPLETE,
      issueCount: 2,
      hasTrend: true,
      netWorthDirection: "positive",
    },
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
      issueCount: 2,
      accountCount: 2,
      holdingCount: 3,
      liabilityCount: 1,
    },
    coverage: {
      accountCount: 2,
      holdingCount: 3,
      liabilityCount: 1,
      snapshotAt: "2026-07-08T00:00:00.000Z",
    },
    reminders: {
      issueCount: 2,
      visibleMessages: [
        "Missing valid price record for Global Fund.",
        "FX rate for USD is stale.",
      ],
      remainingCount: 0,
    },
    allocation: [
      { label: "Stock", value: "900.00", shareOfAssets: "75.00" },
      { label: "Cash", value: "300.00", shareOfAssets: "25.00" },
    ],
    liabilityBreakdown: [],
    trend: {
      firstSelectableDate: "2026-07-01",
      latestSelectableDate: "2026-07-08",
      defaultSelectedDate: "2026-07-08",
      selectedDate: "2026-07-01",
      previousDate: null,
      netWorthChange: "80.00",
      totalAssetsChange: "100.00",
      totalLiabilitiesChange: "20.00",
      monthlyDebtPaymentChange: "5.00",
      visiblePoints: [
        {
          date: "2026-07-01",
          snapshotAt: "2026-07-01T00:00:00.000Z",
          netWorth: "720.00",
          totalAssets: "1100.00",
          totalLiabilities: "380.00",
          monthlyDebtPaymentTotal: "115.00",
        },
        {
          date: "2026-07-08",
          snapshotAt: "2026-07-08T00:00:00.000Z",
          netWorth: "800.00",
          totalAssets: "1200.00",
          totalLiabilities: "400.00",
          monthlyDebtPaymentTotal: "120.00",
        },
      ],
    },
    trendSeries: [
      {
        date: "2026-07-01",
        snapshotAt: "2026-07-01T00:00:00.000Z",
        netWorth: "720.00",
        totalAssets: "1100.00",
        totalLiabilities: "380.00",
        monthlyDebtPaymentTotal: "115.00",
      },
      {
        date: "2026-07-08",
        snapshotAt: "2026-07-08T00:00:00.000Z",
        netWorth: "800.00",
        totalAssets: "1200.00",
        totalLiabilities: "400.00",
        monthlyDebtPaymentTotal: "120.00",
      },
    ],
    issueMessages: [
      "Missing valid price record for Global Fund.",
      "FX rate for USD is stale.",
    ],
  };
}

test("dashboard route renders the dedicated reminders area after authenticated summary load", async () => {
  const requestedUserIds: string[] = [];
  const requestedSelectedDates: Array<string | null | undefined> = [];
  const DashboardPage = createDashboardPage({
    getSession: async () => ({
      sub: "user-1",
      username: "owner",
      role: "ADMIN",
      sessionVersion: 0,
    }),
    createDashboardSummary: async (userId, options) => {
      requestedUserIds.push(userId);
      requestedSelectedDates.push(options.selectedDate);
      return createDashboardSummary();
    },
  });

  const markup = renderToStaticMarkup(
    await DashboardPage({
      searchParams: Promise.resolve({ trendDate: "2026-07-03" }),
    }),
  );

  assert.deepEqual(requestedUserIds, ["user-1"]);
  assert.deepEqual(requestedSelectedDates, ["2026-07-03"]);
  assert.match(markup, /<h2>Reminders<\/h2>/);
  assert.match(markup, /Missing valid price record for Global Fund\./);
  assert.ok(
    markup.indexOf("<h2>Reminders</h2>") < markup.indexOf("<h2>Allocation</h2>"),
    "Dashboard route should place reminders before lower-priority allocation content.",
  );
});
