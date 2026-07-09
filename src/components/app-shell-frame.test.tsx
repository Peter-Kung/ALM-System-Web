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
