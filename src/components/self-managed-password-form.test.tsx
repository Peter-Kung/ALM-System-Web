import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import {
  SelfManagedPasswordFormFields,
  SelfManagedPasswordFormWithDependencies,
  SelfManagedPasswordInvalidState,
} from "@/components/self-managed-password-form";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";

type DomGlobals = Pick<
  typeof globalThis,
  | "document"
  | "Event"
  | "FormData"
  | "HTMLElement"
  | "HTMLInputElement"
  | "self"
  | "window"
>;

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function createDom() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/activate-account?token=valid-token",
  });
  const previousGlobals: Partial<DomGlobals> = {
    document: globalThis.document,
    Event: globalThis.Event,
    FormData: globalThis.FormData,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    self: globalThis.self,
    window: globalThis.window,
  };

  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.FormData = dom.window.FormData;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.self = dom.window as unknown as typeof globalThis.self;
  globalThis.window = dom.window as unknown as typeof globalThis.window;

  const rootElement = dom.window.document.getElementById("root");
  assert.ok(rootElement);

  return {
    document: dom.window.document,
    root: createRoot(rootElement),
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

test("self-managed password fields describe the activation contract", () => {
  const markup = renderToStaticMarkup(
    <form className="card login-card stack">
      <SelfManagedPasswordFormFields mode="activation" pending={false} />
    </form>,
  );

  assert.match(markup, /Account activation/);
  assert.match(markup, /Create your password/);
  assert.match(markup, /name="password"/);
  assert.match(markup, /name="confirmPassword"/);
  assert.match(markup, /minLength="8"/);
  assert.match(markup, /Activate account/);
});

test("self-managed password invalid state keeps the failure safe", () => {
  const markup = renderToStaticMarkup(<SelfManagedPasswordInvalidState mode="reset" />);

  assert.match(markup, /Reset link unavailable/);
  assert.match(markup, /expired, already used, or has been replaced/);
  assert.match(markup, /Return to sign in/);
});

test("self-managed password form submits activation requests and shows success", async () => {
  const { document, root, restore } = createDom();
  const fetchRequests: Array<{ input: string; init?: RequestInit }> = [];

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <SelfManagedPasswordFormWithDependencies
            fetcher={async (input, init) => {
              fetchRequests.push({ input: String(input), init });
              return new Response(JSON.stringify({ ok: true, next: "/login" }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }}
            mode="activation"
            router={{
              refresh() {
                return undefined;
              },
              replace() {
                return undefined;
              },
            }}
            token="valid-token"
            tokenType="ACCOUNT_ACTIVATION"
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const password = document.querySelector<HTMLInputElement>('input[name="password"]');
    const confirmPassword = document.querySelector<HTMLInputElement>(
      'input[name="confirmPassword"]',
    );

    assert.ok(form);
    assert.ok(password);
    assert.ok(confirmPassword);

    password.value = "family-password";
    confirmPassword.value = "family-password";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.equal(fetchRequests.length, 1);
    assert.equal(fetchRequests[0].input, "/api/auth/account-activation");
    assert.equal(fetchRequests[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(fetchRequests[0].init?.body)), {
      token: "valid-token",
      password: "family-password",
      confirmPassword: "family-password",
    });
    assert.match(document.body.textContent ?? "", /Account activated/);
    assert.match(document.body.textContent ?? "", /Continue to sign in/);
  } finally {
    await unmount(root);
    restore();
  }
});

test("self-managed password form keeps reset errors visible", async () => {
  const { document, root, restore } = createDom();

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <SelfManagedPasswordFormWithDependencies
            fetcher={async () =>
              new Response(JSON.stringify({ error: "That link is invalid or expired." }), {
                status: 400,
                headers: { "content-type": "application/json" },
              })
            }
            mode="reset"
            router={{
              refresh() {
                return undefined;
              },
              replace() {
                return undefined;
              },
            }}
            token="expired-token"
            tokenType="PASSWORD_RESET"
          />
        </WorkspaceMutationBoundary>,
      );
    });

    const form = document.querySelector("form");
    const password = document.querySelector<HTMLInputElement>('input[name="password"]');
    const confirmPassword = document.querySelector<HTMLInputElement>(
      'input[name="confirmPassword"]',
    );

    assert.ok(form);
    assert.ok(password);
    assert.ok(confirmPassword);

    password.value = "new-password";
    confirmPassword.value = "new-password";

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    assert.match(document.body.textContent ?? "", /That link is invalid or expired\./);
    assert.ok(document.querySelector('[role="alert"]'));
  } finally {
    await unmount(root);
    restore();
  }
});
