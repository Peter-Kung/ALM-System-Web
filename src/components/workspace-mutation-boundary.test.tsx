import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";

test("workspace mutation boundary renders children without the blocking overlay when idle", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <section>Workspace content</section>
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Workspace content/);
  assert.doesNotMatch(markup, /Workspace update in progress/);
  assert.match(markup, /aria-busy="false"/);
});

test("workspace mutation boundary renders the blocking overlay when a mutation is active", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary initiallyPending>
      <section>Workspace content</section>
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Workspace update in progress/);
  assert.match(markup, /Please wait/);
  assert.match(markup, /temporarily locked/);
  assert.match(markup, /aria-busy="true"/);
});
