import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkspaceSummary } from "@/app/(authenticated)/layout";
import type { DashboardSidebarSummary } from "@/modules/dashboard/service";

test("authenticated layout formats Snapshot pulse amounts with compact K labels", () => {
  const summary = buildWorkspaceSummary(
    createSidebarSummary({
      netWorth: "5589780.46",
      cashPosition: "201158.00",
      investmentValue: "16188622.46",
      totalLiabilities: "10800000.00",
    }),
  );

  assert.equal(summary.netWorthLabel, "5,589.8K TWD");
  assert.deepEqual(summary.metricRows, [
    { label: "Cash", value: "201.2K TWD" },
    { label: "Investments", value: "16,188.6K TWD" },
    { label: "Debt", value: "10,800K TWD" },
  ]);
});

test("authenticated layout keeps small Snapshot pulse amounts readable", () => {
  const summary = buildWorkspaceSummary(
    createSidebarSummary({
      netWorth: "999.99",
      cashPosition: "300.00",
      investmentValue: "900.00",
      totalLiabilities: "400.00",
    }),
  );

  assert.equal(summary.netWorthLabel, "999.99 TWD");
  assert.deepEqual(summary.metricRows, [
    { label: "Cash", value: "300.00 TWD" },
    { label: "Investments", value: "900.00 TWD" },
    { label: "Debt", value: "400.00 TWD" },
  ]);
});

function createSidebarSummary(
  overrides: Partial<DashboardSidebarSummary> = {},
): DashboardSidebarSummary {
  return {
    hasSnapshot: true,
    snapshotAt: "2026-07-11T03:29:00.000Z",
    netWorth: "800.00",
    baseCurrency: "TWD",
    status: "COMPLETE",
    cashPosition: "300.00",
    investmentValue: "900.00",
    totalLiabilities: "400.00",
    accountCount: 4,
    holdingCount: 8,
    reminderLabel: "4 accounts and 8 holdings represented.",
    ...overrides,
  };
}
