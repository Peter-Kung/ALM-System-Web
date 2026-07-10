import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import { LoginFormWithDependencies } from "@/components/login-form";
import { ManagementSection } from "@/components/management-section";
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
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/login" });
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

test("login form blocks duplicate submissions while the sign-in mutation is pending", async () => {
  const { document, root, restore } = createDom();
  const fetchRequests: unknown[] = [];
  const replacedPaths: string[] = [];
  let resolveLogin: (() => void) | undefined;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <LoginFormWithDependencies
            nextPath="/dashboard"
            router={{
              replace(path) {
                replacedPaths.push(path);
              },
              refresh() {
                return undefined;
              },
            }}
            fetcher={async (_input, init) => {
              fetchRequests.push(init);

              return new Promise<Response>((resolve) => {
                resolveLogin = () =>
                  resolve(
                    new Response(JSON.stringify({ next: "/dashboard" }), {
                      status: 200,
                      headers: { "content-type": "application/json" },
                    }),
                  );
              });
            }}
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const username = document.querySelector<HTMLInputElement>('input[name="username"]');
    const password = document.querySelector<HTMLInputElement>('input[name="password"]');
    const submitButton = document.querySelector<HTMLButtonElement>('button[type="submit"]');

    assert.ok(form);
    assert.ok(username);
    assert.ok(password);
    assert.ok(submitButton);

    username.value = "owner";
    password.value = "password123";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.equal(fetchRequests.length, 1);
    assert.equal(submitButton.disabled, true);
    assert.match(document.body.textContent ?? "", /Please wait/);
    assert.ok(document.querySelector('[aria-label="Workspace update in progress"]'));

    await act(async () => {
      resolveLogin?.();
      await Promise.resolve();
    });

    assert.equal(submitButton.disabled, false);
    assert.deepEqual(replacedPaths, ["/dashboard"]);
    assert.doesNotMatch(document.body.textContent ?? "", /Please wait/);
  } finally {
    await unmount(root);
    restore();
  }
});

test("read-only account loading does not activate the shared blocking overlay", async () => {
  const { document, root, restore } = createDom();
  const previousFetch = globalThis.fetch;
  const fetchRequests: string[] = [];

  globalThis.fetch = (async (input) => {
    fetchRequests.push(String(input));

    return new Promise<Response>(() => undefined);
  }) as typeof fetch;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <ManagementSection section="accounts" />
        </WorkspaceMutationBoundary>,
      );
      await Promise.resolve();
    });

    assert.deepEqual(fetchRequests, ["/api/accounts"]);
    assert.match(document.body.textContent ?? "", /Loading accounts\.\.\./);
    assert.doesNotMatch(document.body.textContent ?? "", /Please wait/);
    assert.equal(document.querySelector('[aria-label="Workspace update in progress"]'), null);
    assert.equal(
      document.querySelector(".workspace-mutation-content")?.getAttribute("aria-busy"),
      "false",
    );
  } finally {
    globalThis.fetch = previousFetch;
    await unmount(root);
    restore();
  }
});
