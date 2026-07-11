import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import {
  AccountSettingsFormFields,
  AccountSettingsFormWithDependencies,
} from "@/components/account-settings-form";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";

type DomGlobals = Pick<
  typeof globalThis,
  "document" | "Event" | "FormData" | "HTMLElement" | "HTMLInputElement" | "window"
>;

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

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

test("account settings fields expose the credential update contract", () => {
  const markup = renderToStaticMarkup(
    <form className="card account-settings-card stack">
      <AccountSettingsFormFields
        currentDisplayName="Family Owner"
        currentUsername="owner"
        pending={false}
        error="Current password is required."
      />
    </form>,
  );

  assert.match(markup, /Profile and sign-in/);
  assert.match(markup, /<h2>Account settings<\/h2>/);
  assert.match(markup, /name="displayName"/);
  assert.match(markup, /autoComplete="nickname"/);
  assert.match(markup, /value="Family Owner"/);
  assert.match(markup, /Username/);
  assert.match(markup, />owner</);
  assert.match(markup, /name="currentPassword"/);
  assert.match(markup, /autoComplete="current-password"/);
  assert.match(markup, /name="newPassword"/);
  assert.match(markup, /name="confirmNewPassword"/);
  assert.match(markup, /minLength="8"/);
  assert.match(markup, /Current password is required\./);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /<button type="submit">Save settings<\/button>/);
});

test("account settings form submits credential changes and redirects to login", async () => {
  const { document, root, restore } = createDom();
  const fetchRequests: Array<{ input: string; init?: RequestInit }> = [];
  const replacedPaths: string[] = [];
  let refreshCount = 0;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <AccountSettingsFormWithDependencies
            currentDisplayName={null}
            currentUsername="owner"
            router={{
              replace(path) {
                replacedPaths.push(path);
              },
              refresh() {
                refreshCount += 1;
              },
            }}
            fetcher={async (input, init) => {
              fetchRequests.push({ input: String(input), init });

              return new Response(JSON.stringify({ ok: true, signedOut: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }}
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const displayName = document.querySelector<HTMLInputElement>('input[name="displayName"]');
    const currentPassword = document.querySelector<HTMLInputElement>(
      'input[name="currentPassword"]',
    );
    const newPassword = document.querySelector<HTMLInputElement>('input[name="newPassword"]');
    const confirmNewPassword = document.querySelector<HTMLInputElement>(
      'input[name="confirmNewPassword"]',
    );

    assert.ok(form);
    assert.ok(displayName);
    assert.ok(currentPassword);
    assert.ok(newPassword);
    assert.ok(confirmNewPassword);

    displayName.value = "Family Owner";
    currentPassword.value = "old-password";
    newPassword.value = "new-password";
    confirmNewPassword.value = "new-password";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.equal(fetchRequests.length, 1);
    assert.equal(fetchRequests[0].input, "/api/app/account");
    assert.equal(fetchRequests[0].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(fetchRequests[0].init?.body)), {
      displayName: "Family Owner",
      currentPassword: "old-password",
      newPassword: "new-password",
      confirmNewPassword: "new-password",
    });
    assert.deepEqual(replacedPaths, ["/login"]);
    assert.equal(refreshCount, 1);
  } finally {
    await unmount(root);
    restore();
  }
});

test("account settings form keeps validation errors visible", async () => {
  const { document, root, restore } = createDom();
  const replacedPaths: string[] = [];

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <AccountSettingsFormWithDependencies
            currentDisplayName={null}
            currentUsername="owner"
            router={{
              replace(path) {
                replacedPaths.push(path);
              },
              refresh() {
                return undefined;
              },
            }}
            fetcher={async () =>
              new Response(JSON.stringify({ error: "Current password is incorrect." }), {
                status: 400,
                headers: { "content-type": "application/json" },
              })
            }
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const currentPassword = document.querySelector<HTMLInputElement>(
      'input[name="currentPassword"]',
    );

    assert.ok(form);
    assert.ok(currentPassword);

    currentPassword.value = "wrong-password";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.match(document.body.textContent ?? "", /Current password is incorrect\./);
    assert.ok(document.querySelector('[role="alert"]'));
    assert.deepEqual(replacedPaths, []);
  } finally {
    await unmount(root);
    restore();
  }
});

test("account settings form reports request failures without redirecting", async () => {
  const { document, root, restore } = createDom();
  const replacedPaths: string[] = [];

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <AccountSettingsFormWithDependencies
            currentDisplayName={null}
            currentUsername="owner"
            router={{
              replace(path) {
                replacedPaths.push(path);
              },
              refresh() {
                return undefined;
              },
            }}
            fetcher={async () => {
              throw new Error("network unavailable");
            }}
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const currentPassword = document.querySelector<HTMLInputElement>(
      'input[name="currentPassword"]',
    );

    assert.ok(form);
    assert.ok(currentPassword);

    currentPassword.value = "current-password";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.match(document.body.textContent ?? "", /Unable to update account settings\./);
    assert.ok(document.querySelector('[role="alert"]'));
    assert.deepEqual(replacedPaths, []);
  } finally {
    await unmount(root);
    restore();
  }
});

test("account settings form keeps the session for display-name-only updates", async () => {
  const { document, root, restore } = createDom();
  const replacedPaths: string[] = [];
  let refreshCount = 0;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <AccountSettingsFormWithDependencies
            currentDisplayName="Owner"
            currentUsername="owner"
            router={{
              replace(path) {
                replacedPaths.push(path);
              },
              refresh() {
                refreshCount += 1;
              },
            }}
            fetcher={async () =>
              new Response(JSON.stringify({ ok: true, signedOut: false }), {
                status: 200,
                headers: { "content-type": "application/json" },
              })
            }
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const displayName = document.querySelector<HTMLInputElement>('input[name="displayName"]');

    assert.ok(form);
    assert.ok(displayName);

    displayName.value = "Family Owner";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.match(document.body.textContent ?? "", /Profile updated\./);
    assert.deepEqual(replacedPaths, []);
    assert.equal(refreshCount, 1);
  } finally {
    await unmount(root);
    restore();
  }
});
