import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { ValuationManager } from "@/components/valuation-manager";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";

type DomGlobals = Pick<
  typeof globalThis,
  "document" | "Event" | "FormData" | "HTMLElement" | "HTMLInputElement" | "InputEvent" | "window"
>;

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function createDom() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/manage/valuation",
  });
  const previousGlobals: Partial<DomGlobals> = {
    document: globalThis.document,
    Event: globalThis.Event,
    FormData: globalThis.FormData,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    InputEvent: globalThis.InputEvent,
    window: globalThis.window,
  };

  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.FormData = dom.window.FormData;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.InputEvent = dom.window.InputEvent;
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function changeInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: value,
      inputType: "insertText",
    }),
  );
}

function getFxInput(document: Document, currency: string) {
  const label = Array.from(document.querySelectorAll("label.field")).find(
    (candidate) => candidate.querySelector("span")?.textContent === `${currency} to TWD`,
  );
  assert.ok(label, `Expected ${currency} FX input to exist`);

  const input = label.querySelector("input");
  assert.ok(input, `Expected ${currency} FX input control to exist`);

  return input;
}

function assertStickyPreviewColumn(markup: string) {
  const dom = new JSDOM(markup);
  const grid = dom.window.document.querySelector(".management-grid");
  assert.ok(grid, "Expected management grid to exist");

  const [previewColumn, resultColumn] = Array.from(grid.children);
  assert.ok(previewColumn, "Expected management grid to have a preview column");
  assert.ok(resultColumn, "Expected management grid to have a result column");
  assert.ok(
    previewColumn.classList.contains("management-form-column"),
    "Expected first management grid column to stay sticky on desktop",
  );
  assert.match(previewColumn.textContent ?? "", /Preview inputs/);
  assert.ok(
    !resultColumn.classList.contains("management-form-column"),
    "Expected result column to remain normal document flow",
  );
  assert.match(resultColumn.textContent ?? "", /Preview result/);
}

function buildPreviewPayload(fxRate: string) {
  return {
    status: "COMPLETE",
    baseCurrency: "TWD",
    generatedAt: "2026-07-10T12:05:00.000Z",
    totalAssets: "3125.00",
    totalLiabilities: "0.00",
    netWorth: "3125.00",
    cashPosition: "0.00",
    investmentValue: "3125.00",
    monthlyDebtPaymentTotal: "0.00",
    accounts: [],
    holdings: [],
    liabilities: [],
    issues: [],
    previewInput: {
      generatedAt: "2026-07-10T12:05:00.000Z",
      baseCurrency: "TWD",
      fxRates: [
        {
          currency: "USD",
          rateToBase: fxRate,
        },
      ],
      accounts: [],
      holdings: [],
      liabilities: [],
    },
    confirmationToken: "preview-token",
  };
}

test("valuation manager keeps preview actions in the sticky form column", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <ValuationManager />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Valuation preview/);
  assert.match(markup, /management-grid/);
  assert.match(markup, /management-form-column/);
  assert.match(markup, /Preview inputs/);
  assert.match(markup, /Preview result/);
  assertStickyPreviewColumn(markup);
});

test("valuation manager prefills fetched FX rates into editable inputs", async () => {
  const { document, root, restore } = createDom();
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), "/api/valuation/preview");
    assert.equal(init, undefined);

    return Response.json({
      baseCurrency: "TWD",
      requiredCurrencies: ["USD"],
      fxRateResults: [
        {
          currency: "USD",
          baseCurrency: "TWD",
          status: "FETCHED",
          rateToBase: "31.25",
          provider: "Frankfurter",
          fetchedAt: "2026-07-10T12:00:00.000Z",
          error: null,
        },
      ],
    });
  }) as typeof fetch;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <ValuationManager />
        </WorkspaceMutationBoundary>,
      );
      await Promise.resolve();
    });
    await flushEffects();

    assert.equal(getFxInput(document, "USD").value, "31.25");
  } finally {
    globalThis.fetch = previousFetch;
    await unmount(root);
    restore();
  }
});

test("valuation manager submits the visible manual FX override", async () => {
  const { document, root, restore } = createDom();
  const previousFetch = globalThis.fetch;
  const submittedFxRates: Array<Record<string, unknown>> = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);

    if (url === "/api/valuation/preview" && init === undefined) {
      return Response.json({
        baseCurrency: "TWD",
        requiredCurrencies: ["USD"],
        fxRateResults: [
          {
            currency: "USD",
            baseCurrency: "TWD",
            status: "FETCHED",
            rateToBase: "31.25",
            provider: "Frankfurter",
            fetchedAt: "2026-07-10T12:00:00.000Z",
            error: null,
          },
        ],
      });
    }

    if (url === "/api/valuation/preview" && init?.method === "POST") {
      assert.equal(typeof init.body, "string");
      const payload = JSON.parse(init.body as string) as {
        fxRates: Record<string, unknown>;
      };
      submittedFxRates.push(payload.fxRates);

      return Response.json(buildPreviewPayload(String(payload.fxRates.USD)));
    }

    throw new Error(`Unexpected fetch request: ${url}`);
  }) as typeof fetch;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <ValuationManager />
        </WorkspaceMutationBoundary>,
      );
      await Promise.resolve();
    });
    await flushEffects();

    const input = getFxInput(document, "USD");

    await act(async () => {
      changeInput(input, "29.75");
    });

    const form = document.querySelector("form");
    assert.ok(form);

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flushEffects();

    assert.deepEqual(submittedFxRates, [{ USD: "29.75" }]);
    assert.match(document.body.textContent ?? "", /3125\.00 TWD/);
  } finally {
    globalThis.fetch = previousFetch;
    await unmount(root);
    restore();
  }
});

test("valuation manager keeps failed FX fetch fields editable with feedback", async () => {
  const { document, root, restore } = createDom();
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), "/api/valuation/preview");
    assert.equal(init, undefined);

    return Response.json({
      baseCurrency: "TWD",
      requiredCurrencies: ["USD"],
      fxRateResults: [
        {
          currency: "USD",
          baseCurrency: "TWD",
          status: "FAILED",
          rateToBase: null,
          provider: "Frankfurter",
          fetchedAt: null,
          error: "Failed to fetch USD to TWD.",
        },
      ],
    });
  }) as typeof fetch;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <ValuationManager />
        </WorkspaceMutationBoundary>,
      );
      await Promise.resolve();
    });
    await flushEffects();

    const input = getFxInput(document, "USD");

    assert.equal(input.value, "");
    assert.equal(input.disabled, false);
    assert.match(document.body.textContent ?? "", /Failed to fetch USD to TWD\./);
  } finally {
    globalThis.fetch = previousFetch;
    await unmount(root);
    restore();
  }
});
