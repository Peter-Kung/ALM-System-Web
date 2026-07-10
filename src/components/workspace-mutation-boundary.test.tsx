import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { createWorkspaceMutationController } from "@/components/workspace-mutation-state";

test("workspace mutation controller blocks duplicate mutations while pending", async () => {
  const pendingEvents: boolean[] = [];
  const controller = createWorkspaceMutationController({
    onPendingChange(isPending) {
      pendingEvents.push(isPending);
    },
  });
  let releaseMutation: (() => void) | undefined;

  const firstMutation = controller.run(
    () =>
      new Promise<string>((resolve) => {
        releaseMutation = () => resolve("saved");
      }),
  );
  const duplicateMutation = await controller.run(async () => "duplicate");

  assert.equal(controller.isPending(), true);
  assert.equal(duplicateMutation, undefined);

  releaseMutation?.();

  assert.equal(await firstMutation, "saved");
  assert.equal(controller.isPending(), false);
  assert.deepEqual(pendingEvents, [true, false]);
});

test("workspace mutation controller releases pending state after errors", async () => {
  const pendingEvents: boolean[] = [];
  const controller = createWorkspaceMutationController({
    onPendingChange(isPending) {
      pendingEvents.push(isPending);
    },
  });

  await assert.rejects(
    controller.run(async () => {
      throw new Error("Save failed.");
    }),
    /Save failed\./,
  );

  assert.equal(controller.isPending(), false);
  assert.deepEqual(pendingEvents, [true, false]);
});

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
