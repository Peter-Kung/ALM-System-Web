import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ManagementSectionPage from "@/app/(authenticated)/manage/[section]/page";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";

test("manage accounts route renders the account editor and list regions", async () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      {await ManagementSectionPage({
        params: Promise.resolve({ section: "accounts" }),
      })}
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Account management/);
  assert.match(markup, /Account editor/);
  assert.match(markup, /Account record list/);
  assert.match(markup, /Active accounts/);
  assert.match(markup, /Loading accounts\.\.\./);
});

test("manage section route returns not found for unknown sections", async () => {
  await assert.rejects(
    ManagementSectionPage({
      params: Promise.resolve({ section: "unknown" }),
    }),
    hasNotFoundDigest,
  );
});

function hasNotFoundDigest(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.endsWith(";404")
  );
}
