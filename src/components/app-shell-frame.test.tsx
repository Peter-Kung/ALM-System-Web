import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShellFrame } from "@/components/app-shell-frame";

test("app shell frame renders the summary region, grouped nav, and footer actions", () => {
  const markup = renderToStaticMarkup(
    <AppShellFrame
      pathname="/manage/accounts"
      username="owner"
      summary={{
        latestSnapshotLabel: "Latest snapshot Jul 9, 2026",
        netWorthLabel: "1,230,000 TWD",
        snapshotStatusLabel: "Complete",
        metricRows: [
          { label: "Cash", value: "300,000 TWD" },
          { label: "Investments", value: "930,000 TWD" },
          { label: "Debt", value: "220,000 TWD" },
        ],
        reminderLabel: "2 accounts and 3 holdings represented.",
      }}
    >
      <section>Accounts content</section>
    </AppShellFrame>,
  );

  assert.match(markup, /Workspace financial summary/);
  assert.match(markup, /Dashboard/);
  assert.match(markup, /Data/);
  assert.match(markup, /Workflow/);
  assert.match(markup, /Settings/);
  assert.match(markup, /Sign out/);
  assert.match(markup, /nav-link nav-link-active/);
});

test("app shell frame shows latest snapshot financial context in the sidebar summary", () => {
  const markup = renderToStaticMarkup(
    <AppShellFrame
      pathname="/dashboard"
      username="owner"
      summary={{
        latestSnapshotLabel: "Latest snapshot Jul 9, 2026, 7:15 PM",
        netWorthLabel: "800.00 TWD",
        snapshotStatusLabel: "Complete",
        metricRows: [
          { label: "Cash", value: "300.00 TWD" },
          { label: "Investments", value: "900.00 TWD" },
          { label: "Debt", value: "400.00 TWD" },
        ],
        reminderLabel: "1 accounts and 1 holdings represented.",
      }}
    >
      <section>Dashboard content</section>
    </AppShellFrame>,
  );

  assert.match(markup, /Workspace financial summary/);
  assert.match(markup, /Snapshot pulse/);
  assert.match(markup, /800\.00 TWD/);
  assert.match(markup, /Complete/);
  assert.match(markup, /Latest snapshot Jul 9, 2026, 7:15 PM/);
  assert.match(markup, /Cash/);
  assert.match(markup, /300\.00 TWD/);
  assert.match(markup, /Investments/);
  assert.match(markup, /900\.00 TWD/);
  assert.match(markup, /Debt/);
  assert.match(markup, /400\.00 TWD/);
  assert.match(markup, /1 accounts and 1 holdings represented\./);
});

test("app shell frame renders the sidebar summary before the first snapshot", () => {
  const markup = renderToStaticMarkup(
    <AppShellFrame
      pathname="/dashboard"
      username="owner"
      summary={{
        latestSnapshotLabel: "No snapshot saved yet",
        netWorthLabel: "Awaiting baseline",
        snapshotStatusLabel: "Not started",
        metricRows: [
          { label: "Cash", value: "No data" },
          { label: "Investments", value: "No data" },
          { label: "Debt", value: "No data" },
        ],
        reminderLabel: "Run the first valuation preview to populate the workspace pulse.",
      }}
    >
      <section>Dashboard content</section>
    </AppShellFrame>,
  );

  assert.match(markup, /Workspace financial summary/);
  assert.match(markup, /Awaiting baseline/);
  assert.match(markup, /Not started/);
  assert.match(markup, /No snapshot saved yet/);
  assert.match(markup, /No data/);
  assert.match(markup, /Run the first valuation preview to populate the workspace pulse\./);
});
