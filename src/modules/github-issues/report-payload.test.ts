import assert from "node:assert/strict";
import test from "node:test";

import { RepositoryValidationError } from "@/lib/repository-utils";
import { parseIssueReportPayload } from "@/modules/github-issues/report-payload";

test("parseIssueReportPayload trims required fields and normalizes the page path", () => {
  const payload = parseIssueReportPayload({
    title: "  Sidebar issue report  ",
    description: "  The sidebar footer button does not open.  ",
    pagePath: "manage/assets",
  });

  assert.deepEqual(payload, {
    title: "Sidebar issue report",
    description: "The sidebar footer button does not open.",
    pagePath: "/manage/assets",
  });
});

test("parseIssueReportPayload rejects missing required values", () => {
  assert.throws(
    () =>
      parseIssueReportPayload({
        title: " ",
        description: "Still here",
        pagePath: "/dashboard",
      }),
    (error: unknown) =>
      error instanceof RepositoryValidationError && error.message === "title is required.",
  );
});
