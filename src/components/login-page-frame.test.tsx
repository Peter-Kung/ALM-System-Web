import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LoginFormFields } from "@/components/login-form";
import { LoginPageFrame } from "@/components/login-page-frame";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";

test("login page frame renders only the centered auth panel", () => {
  const markup = renderToStaticMarkup(
    <LoginPageFrame>
      <form className="login-card stack">
        <LoginFormFields nextPath="/dashboard" pending={false} />
      </form>
    </LoginPageFrame>,
  );

  assert.match(markup, /Owner sign in panel/);
  assert.doesNotMatch(markup, /login-hero/);
  assert.doesNotMatch(markup, /Private balance sheet workspace/);
  assert.doesNotMatch(markup, /Snapshot pulse/);
  assert.match(markup, /name="next"/);
  assert.match(markup, /value="\/dashboard"/);
  assert.match(markup, /name="username"/);
  assert.match(markup, /autoComplete="username"/);
  assert.match(markup, /name="password"/);
  assert.match(markup, /type="password"/);
  assert.match(markup, /<h1>Sign in to workspace<\/h1>/);
});

test("login page frame can use the shared blocking mutation overlay", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary initiallyPending>
      <LoginPageFrame>
        <form className="login-card stack">
          <LoginFormFields nextPath="/dashboard" pending />
        </form>
      </LoginPageFrame>
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Workspace update in progress/);
  assert.match(markup, /Please wait/);
  assert.match(markup, /Signing in\.\.\./);
  assert.match(markup, /<button type="submit" disabled="">Signing in\.\.\.<\/button>/);
  assert.match(markup, /aria-busy="true"/);
});
