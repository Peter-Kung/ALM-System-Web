import assert from "node:assert/strict";
import test from "node:test";

import { footerNavigation, primaryNavigation } from "@/lib/navigation";

test("primary navigation preserves the approved workspace grouping", () => {
  assert.deepEqual(
    primaryNavigation.map((group) => group.heading),
    ["Dashboard", "Data", "Workflow"],
  );

  assert.deepEqual(primaryNavigation[0]?.items, [
    { href: "/dashboard", label: "Dashboard", shortLabel: "01" },
  ]);

  assert.deepEqual(
    primaryNavigation.flatMap((group) => group.items.map((item) => item.href)),
    [
      "/dashboard",
      "/manage/accounts",
      "/manage/assets",
      "/manage/holdings",
      "/manage/liabilities",
      "/manage/prices",
      "/manage/valuation",
      "/manage/snapshots",
    ],
  );
});

test("footer navigation exposes settings as a shell action", () => {
  assert.deepEqual(footerNavigation, [
    { href: "/settings/account", label: "Settings", shortLabel: "09" },
  ]);
});
