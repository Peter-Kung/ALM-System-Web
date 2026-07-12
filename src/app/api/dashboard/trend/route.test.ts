import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { getDashboardTrendHandler } from "@/app/api/dashboard/trend/handler";

test("getDashboardTrendHandler returns the selected trend payload for the signed-in user", async () => {
  const requested: Array<{ userId: string; selectedDate: string | null | undefined }> = [];

  const response = await getDashboardTrendHandler(
    new NextRequest("https://example.test/api/dashboard/trend?trendDate=2026-07-03"),
    {
      async createDashboardTrend(userId, options) {
        requested.push({ userId, selectedDate: options?.selectedDate });
        return {
          firstSelectableDate: "2026-07-01",
          latestSelectableDate: "2026-07-08",
          defaultSelectedDate: "2026-07-08",
          selectedDate: "2026-07-03",
          previousDate: "2026-07-02",
          netWorthChange: "10.00",
          totalAssetsChange: "10.00",
          totalLiabilitiesChange: "0.00",
          monthlyDebtPaymentChange: "0.00",
          visiblePoints: [
            {
              date: "2026-07-03",
              snapshotAt: "2026-07-03T00:00:00.000Z",
              netWorth: "780.00",
              totalAssets: "1180.00",
              totalLiabilities: "400.00",
              monthlyDebtPaymentTotal: "120.00",
            },
          ],
        };
      },
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "user-1",
            displayName: null,
            username: "owner",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.deepEqual(requested, [{ userId: "user-1", selectedDate: "2026-07-03" }]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    trend: {
      firstSelectableDate: "2026-07-01",
      latestSelectableDate: "2026-07-08",
      defaultSelectedDate: "2026-07-08",
      selectedDate: "2026-07-03",
      previousDate: "2026-07-02",
      netWorthChange: "10.00",
      totalAssetsChange: "10.00",
      totalLiabilitiesChange: "0.00",
      monthlyDebtPaymentChange: "0.00",
      visiblePoints: [
        {
          date: "2026-07-03",
          snapshotAt: "2026-07-03T00:00:00.000Z",
          netWorth: "780.00",
          totalAssets: "1180.00",
          totalLiabilities: "400.00",
          monthlyDebtPaymentTotal: "120.00",
        },
      ],
    },
  });
});
