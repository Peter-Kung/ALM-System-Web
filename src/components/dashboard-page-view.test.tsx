import assert from "node:assert/strict";
import test from "node:test";

import { SnapshotStatus } from "@prisma/client";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardPageView } from "@/components/dashboard-page-view";
import { getDashboardTrendAxisLayout } from "@/components/dashboard-trend-card";
import type { DashboardSummary } from "@/modules/dashboard/service";

type DomGlobals = Pick<
  typeof globalThis,
  | "document"
  | "Event"
  | "HTMLElement"
  | "HTMLInputElement"
  | "localStorage"
  | "self"
  | "window"
>;

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function createDashboardDom() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/dashboard" });
  const previousGlobals: Partial<DomGlobals> = {
    document: globalThis.document,
    Event: globalThis.Event,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    localStorage: globalThis.localStorage,
    self: globalThis.self,
    window: globalThis.window,
  };

  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.self = dom.window as unknown as Window & typeof globalThis;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;

  const rootElement = dom.window.document.getElementById("root");
  assert.ok(rootElement);

  const root = createRoot(rootElement);

  return {
    document: dom.window.document,
    root,
    restore() {
      for (const [key, value] of Object.entries(previousGlobals)) {
        if (value === undefined) {
          delete (globalThis as Record<string, unknown>)[key];
        } else {
          (globalThis as Record<string, unknown>)[key] = value;
        }
      }
      dom.window.close();
    },
  };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
  });
}

function createDashboardSummary(
  overrides: Partial<DashboardSummary> = {},
): DashboardSummary {
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
      issueCount: 4,
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
      issueCount: 4,
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
      issueCount: 4,
      visibleMessages: [
        "Missing valid price record for Global Fund.",
        "FX rate for USD is stale.",
        "Cash account balance needs refresh.",
      ],
      remainingCount: 1,
    },
    allocation: [
      { label: "Stock", value: "900.00", shareOfAssets: "75.00" },
      { label: "Cash", value: "300.00", shareOfAssets: "25.00" },
    ],
    liabilityBreakdown: [
      { label: "Mortgage", value: "400.00", shareOfAssets: "100.00" },
    ],
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
        sidebarSummary: {
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
        },
        emptyState: {
          actionHref: "/manage/valuation",
        },
        heroSummary: null,
        latestSnapshot: null,
        coverage: null,
        reminders: {
          issueCount: 0,
          visibleMessages: [],
          remainingCount: 0,
        },
        allocation: [],
        liabilityBreakdown: [],
        trend: null,
        trendSeries: [],
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
  assert.match(markup, /Total assets/);
  assert.match(markup, /Total liabilities/);
  assert.match(markup, /Cash position/);
  assert.match(markup, /Allocation/);
  assert.match(markup, /Stock/);
  assert.match(markup, /Cash/);
  assert.match(markup, /TWD 900.00/);
  assert.match(markup, /TWD 300.00/);
  assert.match(markup, /75.00%/);
  assert.match(markup, /25.00%/);
  assert.match(markup, /Reminders/);
  assert.match(markup, /Next up/);
  assert.match(markup, /Coverage/);
  assert.match(markup, /Trend summary/);
  assert.match(markup, /Daily line trend/);
  assert.match(markup, /Net worth/);
  assert.match(markup, /Assets/);
  assert.match(markup, /Liabilities/);
  assert.match(markup, /Monthly debt payments/);
  assert.match(markup, /Jul 1/);
  assert.match(markup, /Jul 8/);
  assert.match(markup, /The latest snapshot is usable, but reminder items still need follow-up\./);
  assert.match(markup, /4 reminder items recorded in the latest snapshot\./);
  assert.match(markup, /Missing valid price record for Global Fund\./);
  assert.match(markup, /FX rate for USD is stale\./);
  assert.match(markup, /Cash account balance needs refresh\./);
  assert.match(markup, /1 more reminder recorded in the latest snapshot\./);
  assert.doesNotMatch(markup, /Older reminder should be hidden\./);
  assert.doesNotMatch(markup, /Debt balances/);
  assert.ok(
    markup.indexOf("<h2>Reminders</h2>") < markup.indexOf("<h2>Allocation</h2>"),
    "Reminders should render before lower-priority allocation and trend sections.",
  );
});

test("dashboard page view formats read-only money values with K units", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={createDashboardSummary({
        latestSnapshot: {
          id: "snapshot-1",
          status: SnapshotStatus.COMPLETE,
          baseCurrency: "TWD",
          totalAssets: "1200.00",
          totalLiabilities: "1000.00",
          netWorth: "999.99",
          cashPosition: "300.00",
          investmentValue: "900.00",
          monthlyDebtPaymentTotal: "120.00",
          snapshotAt: "2026-07-08T00:00:00.000Z",
          issueCount: 4,
          accountCount: 2,
          holdingCount: 3,
          liabilityCount: 1,
        },
        allocation: [
          { label: "Stock", value: "1200.00", shareOfAssets: "54.55" },
          { label: "Cash", value: "999.99", shareOfAssets: "45.45" },
        ],
        trendSeries: [
          {
            date: "2026-07-01",
            snapshotAt: "2026-07-01T00:00:00.000Z",
            netWorth: "900.00",
            totalAssets: "1000.00",
            totalLiabilities: "100.00",
            monthlyDebtPaymentTotal: "100.00",
          },
          {
            date: "2026-07-08",
            snapshotAt: "2026-07-08T00:00:00.000Z",
            netWorth: "999.99",
            totalAssets: "1200.00",
            totalLiabilities: "1000.00",
            monthlyDebtPaymentTotal: "120.00",
          },
        ],
      })}
    />,
  );

  assert.match(markup, /999\.99 TWD/);
  assert.match(markup, /1\.2K TWD/);
  assert.match(markup, /1K TWD/);
  assert.match(markup, /TWD 1\.2K/);
  assert.match(markup, /TWD 999\.99/);
  assert.doesNotMatch(markup, /1200\.00 TWD/);
  assert.doesNotMatch(markup, /TWD 1200\.00/);
});

test("dashboard page view labels carried-forward trend points by calendar date", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={createDashboardSummary({
        trend: {
          firstSelectableDate: "2026-07-01",
          latestSelectableDate: "2026-07-02",
          defaultSelectedDate: "2026-07-02",
          selectedDate: "2026-07-01",
          previousDate: null,
          netWorthChange: "0.00",
          totalAssetsChange: "0.00",
          totalLiabilitiesChange: "0.00",
          monthlyDebtPaymentChange: "0.00",
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
              date: "2026-07-02",
              snapshotAt: "2026-07-01T00:00:00.000Z",
              netWorth: "720.00",
              totalAssets: "1100.00",
              totalLiabilities: "380.00",
              monthlyDebtPaymentTotal: "115.00",
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
            date: "2026-07-02",
            snapshotAt: "2026-07-01T00:00:00.000Z",
            netWorth: "720.00",
            totalAssets: "1100.00",
            totalLiabilities: "380.00",
            monthlyDebtPaymentTotal: "115.00",
          },
        ],
      })}
    />,
  );

  assert.match(markup, /Jul 1/);
  assert.match(markup, /Jul 2/);
});

test("dashboard page view renders selectable trend controls with bounded dates", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView dashboard={createDashboardSummary()} />,
  );

  assert.match(
    markup,
    /<button type="button" class="dashboard-trend-arrow" disabled="" aria-label="Previous day"/,
  );
  assert.match(markup, /aria-label="Next day"/);
  assert.doesNotMatch(markup, /aria-label="Next day" disabled=""/);
  assert.match(markup, /type="date"/);
  assert.match(markup, /min="2026-07-01"/);
  assert.match(markup, /max="2026-07-08"/);
  assert.match(markup, /value="2026-07-01"/);
});

test("dashboard trend controls remain available when the selected window has one point", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={createDashboardSummary({
        trend: {
          firstSelectableDate: "2026-07-01",
          latestSelectableDate: "2026-07-08",
          defaultSelectedDate: "2026-07-08",
          selectedDate: "2026-07-08",
          previousDate: "2026-07-07",
          netWorthChange: "0.00",
          totalAssetsChange: "0.00",
          totalLiabilitiesChange: "0.00",
          monthlyDebtPaymentChange: "0.00",
          visiblePoints: [
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
      })}
    />,
  );

  assert.match(markup, /Daily line trend/);
  assert.match(markup, /aria-label="Previous day"/);
  assert.doesNotMatch(markup, /aria-label="Previous day" disabled=""/);
  assert.match(
    markup,
    /<button type="button" class="dashboard-trend-arrow" disabled="" aria-label="Next day"/,
  );
  assert.match(markup, /value="2026-07-08"/);
});

test("dashboard trend date picker updates only the trend card without navigation", async () => {
  const { document, root, restore } = createDashboardDom();
  const previousFetch = globalThis.fetch;
  const fetchCalls: string[] = [];
  const replaceStateCalls: string[] = [];
  const previousReplaceState = globalThis.window.history.replaceState.bind(globalThis.window.history);

  globalThis.fetch = (async (input) => {
    fetchCalls.push(String(input));

    return new Response(
      JSON.stringify({
        trend: {
          firstSelectableDate: "2026-07-01",
          latestSelectableDate: "2026-07-08",
          defaultSelectedDate: "2026-07-08",
          selectedDate: "2026-07-02",
          previousDate: "2026-07-01",
          netWorthChange: "5.00",
          totalAssetsChange: "5.00",
          totalLiabilitiesChange: "0.00",
          monthlyDebtPaymentChange: "0.00",
          visiblePoints: [
            {
              date: "2026-07-02",
              snapshotAt: "2026-07-02T00:00:00.000Z",
              netWorth: "725.00",
              totalAssets: "1105.00",
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
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  globalThis.window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    void data;
    void unused;
    replaceStateCalls.push(String(url ?? ""));
  }) as typeof globalThis.window.history.replaceState;

  try {
    await act(async () => {
      root.render(<DashboardPageView dashboard={createDashboardSummary()} />);
    });

    const trendDateInput = document.querySelector<HTMLInputElement>('input[name="trendDate"]');

    assert.ok(trendDateInput);

    trendDateInput.value = "2026-07-02";

    await act(async () => {
      trendDateInput.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.deepEqual(fetchCalls, ["/api/dashboard/trend?trendDate=2026-07-02"]);
    assert.deepEqual(replaceStateCalls, ["/dashboard?trendDate=2026-07-02"]);
    assert.equal(trendDateInput.value, "2026-07-02");
    assert.match(document.body.textContent ?? "", /Jul 2 to Jul 8/);
    assert.match(document.body.textContent ?? "", /Net worth/);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window.history.replaceState = previousReplaceState;
    await unmount(root);
    restore();
  }
});

test("dashboard trend previous and next controls fetch local card updates", async () => {
  const { document, root, restore } = createDashboardDom();
  const previousFetch = globalThis.fetch;
  const previousReplaceState = globalThis.window.history.replaceState.bind(globalThis.window.history);
  const fetchCalls: string[] = [];

  globalThis.fetch = (async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    const selectedDate = url.includes("2026-07-02") ? "2026-07-02" : "2026-07-03";

    return new Response(
      JSON.stringify({
        trend: {
          firstSelectableDate: "2026-07-01",
          latestSelectableDate: "2026-07-08",
          defaultSelectedDate: "2026-07-08",
          selectedDate,
          previousDate: selectedDate === "2026-07-02" ? "2026-07-01" : "2026-07-02",
          netWorthChange: "5.00",
          totalAssetsChange: "5.00",
          totalLiabilitiesChange: "0.00",
          monthlyDebtPaymentChange: "0.00",
          visiblePoints: [
            {
              date: selectedDate,
              snapshotAt: `${selectedDate}T00:00:00.000Z`,
              netWorth: "725.00",
              totalAssets: "1105.00",
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
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  globalThis.window.history.replaceState = (() => undefined) as typeof globalThis.window.history.replaceState;

  try {
    await act(async () => {
      root.render(
        <DashboardPageView
          dashboard={createDashboardSummary({
            trend: {
              firstSelectableDate: "2026-07-01",
              latestSelectableDate: "2026-07-08",
              defaultSelectedDate: "2026-07-08",
              selectedDate: "2026-07-03",
              previousDate: "2026-07-02",
              netWorthChange: "0.00",
              totalAssetsChange: "0.00",
              totalLiabilitiesChange: "0.00",
              monthlyDebtPaymentChange: "0.00",
              visiblePoints: [
                {
                  date: "2026-07-03",
                  snapshotAt: "2026-07-03T00:00:00.000Z",
                  netWorth: "730.00",
                  totalAssets: "1110.00",
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
          })}
        />,
      );
    });

    const buttons = document.querySelectorAll<HTMLButtonElement>(".dashboard-trend-arrow");
    assert.equal(buttons.length, 2);

    await act(async () => {
      buttons[0].click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      buttons[1].click();
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.deepEqual(fetchCalls, [
      "/api/dashboard/trend?trendDate=2026-07-02",
      "/api/dashboard/trend?trendDate=2026-07-03",
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window.history.replaceState = previousReplaceState;
    await unmount(root);
    restore();
  }
});

test("dashboard trend card renders the selected visible window only", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={createDashboardSummary({
        trend: {
          firstSelectableDate: "2026-07-01",
          latestSelectableDate: "2026-07-08",
          defaultSelectedDate: "2026-07-08",
          selectedDate: "2026-07-03",
          previousDate: "2026-07-02",
          netWorthChange: "0.00",
          totalAssetsChange: "0.00",
          totalLiabilitiesChange: "0.00",
          monthlyDebtPaymentChange: "0.00",
          visiblePoints: [
            {
              date: "2026-07-03",
              snapshotAt: "2026-07-01T00:00:00.000Z",
              netWorth: "720.00",
              totalAssets: "1100.00",
              totalLiabilities: "380.00",
              monthlyDebtPaymentTotal: "115.00",
            },
            {
              date: "2026-07-04",
              snapshotAt: "2026-07-04T00:00:00.000Z",
              netWorth: "760.00",
              totalAssets: "1140.00",
              totalLiabilities: "380.00",
              monthlyDebtPaymentTotal: "115.00",
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
            date: "2026-07-03",
            snapshotAt: "2026-07-01T00:00:00.000Z",
            netWorth: "720.00",
            totalAssets: "1100.00",
            totalLiabilities: "380.00",
            monthlyDebtPaymentTotal: "115.00",
          },
          {
            date: "2026-07-04",
            snapshotAt: "2026-07-04T00:00:00.000Z",
            netWorth: "760.00",
            totalAssets: "1140.00",
            totalLiabilities: "380.00",
            monthlyDebtPaymentTotal: "115.00",
          },
        ],
      })}
    />,
  );

  assert.doesNotMatch(markup, /Jul 1/);
  assert.match(markup, /Jul 3/);
  assert.match(markup, /Jul 4/);
});

test("dashboard trend chart keeps compact axis spacing for K-formatted labels", () => {
  const layout = getDashboardTrendAxisLayout();

  assert.equal(layout.yAxisWidth, 72);
  assert.equal(layout.margin.left, -20);
});

test("dashboard page view renders a stable allocation fallback when no allocation data exists", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={createDashboardSummary({
        allocation: [],
      })}
    />,
  );

  assert.match(markup, /Allocation/);
  assert.match(markup, /No allocation data is available in the latest snapshot\./);
});

test("dashboard page view hides the trend card when fewer than two snapshots exist", () => {
  const markup = renderToStaticMarkup(
    <DashboardPageView
      dashboard={createDashboardSummary({
        heroSummary: {
          snapshotAt: "2026-07-08T00:00:00.000Z",
          status: SnapshotStatus.COMPLETE,
          issueCount: 4,
          hasTrend: false,
          netWorthDirection: "positive",
        },
        trend: null,
        trendSeries: [
          {
            date: "2026-07-08",
            snapshotAt: "2026-07-08T00:00:00.000Z",
            netWorth: "800.00",
            totalAssets: "1200.00",
            totalLiabilities: "400.00",
            monthlyDebtPaymentTotal: "120.00",
          },
        ],
      })}
    />,
  );

  assert.doesNotMatch(markup, /<h2>Trend<\/h2>/);
  assert.doesNotMatch(markup, /Daily line trend/);
});
