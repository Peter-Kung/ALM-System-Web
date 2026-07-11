import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import {
  DeploymentSettingsPanelWithDependencies,
} from "@/components/deployment-settings-panel";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import type { DeploymentState } from "@/modules/deployment";

type DomGlobals = Pick<
  typeof globalThis,
  "document" | "Event" | "FormData" | "HTMLElement" | "HTMLInputElement" | "window"
>;

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const deployment: DeploymentState = {
  currentImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
  currentVersion: "sha-old",
  latestImage: "ghcr.io/peter-kung/alm-system-web:sha-new",
  latestVersion: "sha-new",
  newerAvailable: true,
  lastCheckAt: "2026-07-11T10:30:00.000Z",
  pendingOperation: null,
  lastUpdate: {
    status: "rolled_back",
    fromImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
    targetImage: "ghcr.io/peter-kung/alm-system-web:sha-new",
    activeImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
    backupPath: "/opt/alm-system/backups/alm-system.db",
    message: "Update validation failed.",
    updatedAt: "2026-07-11T11:00:00.000Z",
  },
};

function createDom() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/settings/account",
  });
  const previousGlobals: Partial<DomGlobals> = {
    document: globalThis.document,
    Event: globalThis.Event,
    FormData: globalThis.FormData,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    window: globalThis.window,
  };

  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.FormData = dom.window.FormData;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  dom.window.confirm = () => true;

  const rootElement = dom.window.document.getElementById("root");
  assert.ok(rootElement);

  const root = createRoot(rootElement);

  return {
    document: dom.window.document,
    root,
    restore() {
      for (const [key, value] of Object.entries(previousGlobals)) {
        if (value === undefined) {
          delete (globalThis as Record<string, unknown>)[key];
        } else {
          (globalThis as Record<string, unknown>)[key] = value;
        }
      }
      dom.window.close();
    },
  };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
  });
}

test("deployment settings panel renders version state and update controls", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <DeploymentSettingsPanelWithDependencies
        fetcher={fetch}
        initialDeployment={deployment}
      />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Version and updates/);
  assert.match(markup, /sha-old/);
  assert.match(markup, /sha-new/);
  assert.match(markup, /Check updates/);
  assert.match(markup, /Start update/);
  assert.match(markup, /Start rollback/);
  assert.match(markup, /Update validation failed\./);
});

test("deployment settings panel starts update operations with the selected image", async () => {
  const { document, root, restore } = createDom();
  const requests: Array<{ input: string; init?: RequestInit }> = [];

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <DeploymentSettingsPanelWithDependencies
            fetcher={async (input, init) => {
              requests.push({ input: String(input), init });
              if (String(input) === "/api/app/deployment") {
                return Response.json({ deployment });
              }

              return Response.json({ operation: "update", requested: true }, { status: 202 });
            }}
            initialDeployment={deployment}
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector<HTMLFormElement>(".deployment-update-form");
    const targetImage = document.querySelector<HTMLInputElement>(
      'input[name="targetImage"]',
    );

    assert.ok(form);
    assert.ok(targetImage);
    const valueSetter = Object.getOwnPropertyDescriptor(
      globalThis.HTMLInputElement.prototype,
      "value",
    )?.set;
    assert.ok(valueSetter);
    await act(async () => {
      valueSetter.call(targetImage, "ghcr.io/peter-kung/alm-system-web:sha-next");
      targetImage.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(requests[0].input, "/api/app/deployment/update");
    assert.equal(requests[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      targetImage: "ghcr.io/peter-kung/alm-system-web:sha-next",
    });
  } finally {
    await unmount(root);
    restore();
  }
});
