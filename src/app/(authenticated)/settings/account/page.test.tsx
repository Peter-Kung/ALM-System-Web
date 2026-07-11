import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AccountSettingsPageContent } from "@/components/account-settings-page-content";
import type { DeploymentState } from "@/modules/deployment";

const deployment: DeploymentState = {
  currentImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
  currentVersion: "sha-old",
  latestImage: "ghcr.io/peter-kung/alm-system-web:sha-new",
  latestVersion: "sha-new",
  newerAvailable: true,
  lastCheckAt: null,
  pendingOperation: null,
  lastUpdate: null,
};

test("account settings page hides deployment controls without administrator state", () => {
  const markup = renderToStaticMarkup(
    <AccountSettingsPageContent accountForm={<div>Account form</div>} deployment={null} />,
  );

  assert.match(markup, /Account settings/);
  assert.doesNotMatch(markup, /Version and updates/);
  assert.doesNotMatch(markup, /Start rollback/);
});

test("account settings page renders deployment controls for administrators", () => {
  const markup = renderToStaticMarkup(
    <AccountSettingsPageContent
      accountForm={<div>Account form</div>}
      deployment={deployment}
      deploymentPanel={<div>Version and updates Start rollback</div>}
    />,
  );

  assert.match(markup, /Version and updates/);
  assert.match(markup, /Start rollback/);
});
