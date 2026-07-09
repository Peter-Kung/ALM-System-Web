import assert from "node:assert/strict";
import test from "node:test";

import { formatUtcDateTime } from "@/lib/date-format";

test("formatUtcDateTime keeps snapshot timestamps pinned to UTC", () => {
  assert.equal(
    formatUtcDateTime("2026-07-09T23:30:00.000Z"),
    "Jul 9, 2026, 11:30 PM",
  );
});
