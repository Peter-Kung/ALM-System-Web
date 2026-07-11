import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import {
  AccountRecordCard,
  AssetRecordCard,
  AssetSymbolGuidance,
  ManagementSection,
  formatCurrencyAmount,
  getAssetSymbolGuidance,
  getAccountActionLabel,
} from "@/components/management-section";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { AccountType, AssetPriceSourceType, AssetType } from "@prisma/client";

type DomGlobals = Pick<
  typeof globalThis,
  "document" | "Event" | "HTMLElement" | "HTMLInputElement" | "HTMLSelectElement" | "window"
>;

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function createDom() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/manage/assets" });
  const previousGlobals: Partial<DomGlobals> = {
    document: globalThis.document,
    Event: globalThis.Event,
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    window: globalThis.window,
  };

  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
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

function changeSelect(select: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  valueSetter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function getFieldControl<T extends HTMLElement>(document: Document, labelText: string) {
  const label = Array.from(document.querySelectorAll("label.field")).find(
    (candidate) => candidate.querySelector("span")?.textContent === labelText,
  );
  assert.ok(label, `Expected ${labelText} field to exist`);

  const control = label.querySelector("input, select, textarea");
  assert.ok(control, `Expected ${labelText} field to have a control`);

  return control as T;
}

function getResourceCardByHeading(document: Document, headingText: string) {
  const heading = Array.from(document.querySelectorAll(".resource-card h3")).find(
    (candidate) => candidate.textContent === headingText,
  );
  assert.ok(heading, `Expected ${headingText} resource card to exist`);

  const card = heading.closest(".resource-card");
  assert.ok(card, `Expected ${headingText} heading to be inside a resource card`);

  return card;
}

function assertStickyActionColumn(
  markup: string,
  actionText: string | string[],
  listText: string,
) {
  const dom = new JSDOM(markup);
  const grid = dom.window.document.querySelector(".management-grid");
  assert.ok(grid, "Expected management grid to exist");

  const [actionColumn, listColumn] = Array.from(grid.children);
  assert.ok(actionColumn, "Expected management grid to have an action column");
  assert.ok(listColumn, "Expected management grid to have a list column");
  assert.ok(
    actionColumn.classList.contains("management-form-column"),
    "Expected first management grid column to stay sticky on desktop",
  );
  for (const expectedActionText of [actionText].flat()) {
    assert.match(actionColumn.textContent ?? "", new RegExp(expectedActionText));
  }
  assert.ok(
    !listColumn.classList.contains("management-form-column"),
    "Expected list column to remain normal document flow",
  );
  assert.match(listColumn.textContent ?? "", new RegExp(listText));
}

test("accounts management section renders the split editor and card-list template", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <ManagementSection section="accounts" />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Account management/);
  assert.match(markup, /Account editor/);
  assert.match(markup, /Account record list/);
  assert.match(markup, /Active accounts/);
  assert.match(markup, /Create account/);
  assert.match(markup, /Loading accounts\.\.\./);
  assert.doesNotMatch(markup, /Workspace update in progress/);
  assert.match(markup, /management-grid management-grid-accounts/);
});

test("accounts management section can be locked by the shared mutation overlay", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary initiallyPending>
      <ManagementSection section="accounts" />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Account editor/);
  assert.match(markup, /Create account/);
  assert.match(markup, /Workspace update in progress/);
  assert.match(markup, /temporarily locked/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /inert=""/);
});

test("assets management section keeps the editor in the sticky form column", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <ManagementSection section="assets" />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Asset management/);
  assert.match(markup, /management-grid/);
  assert.match(markup, /management-form-column/);
  assert.match(markup, /Add asset/);
  assert.match(markup, /Existing assets/);
  assertStickyActionColumn(markup, "Add asset", "Existing assets");
});

test("holdings management section keeps the editor in the sticky form column", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <ManagementSection section="holdings" />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Holding management/);
  assert.match(markup, /management-grid/);
  assert.match(markup, /management-form-column/);
  assert.match(markup, /Add holding/);
  assert.match(markup, /Existing holdings/);
  assertStickyActionColumn(markup, "Add holding", "Existing holdings");
});

test("liabilities management section keeps the editor in the sticky form column", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <ManagementSection section="liabilities" />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Liability management/);
  assert.match(markup, /management-grid/);
  assert.match(markup, /management-form-column/);
  assert.match(markup, /Add liability/);
  assert.match(markup, /Existing liabilities/);
  assertStickyActionColumn(markup, "Add liability", "Existing liabilities");
});

test("prices management section keeps price actions in the sticky form column", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceMutationBoundary>
      <ManagementSection section="prices" />
    </WorkspaceMutationBoundary>,
  );

  assert.match(markup, /Price records/);
  assert.match(markup, /management-grid/);
  assert.match(markup, /management-form-column/);
  assert.match(markup, /Automatic refresh/);
  assert.match(markup, /Manual entry/);
  assertStickyActionColumn(markup, ["Automatic refresh", "Manual entry"], "Latest price status");
});

test("assets management flow saves and displays real estate assets", async () => {
  const { document, root, restore } = createDom();
  const previousFetch = globalThis.fetch;
  const submittedPayloads: Array<Record<string, unknown>> = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);

    if (url === "/api/assets" && init === undefined) {
      return Response.json({
        assets: [
          {
            id: "asset-house",
            name: "House",
            assetType: AssetType.STOCK,
            symbol: null,
            currency: "TWD",
            priceSourceType: AssetPriceSourceType.AUTO,
            isActive: true,
            notes: null,
          },
        ],
      });
    }

    if (url === "/api/assets/asset-house" && init?.method === "PUT") {
      if (typeof init.body !== "string") {
        throw new Error("Expected asset update request to submit a JSON body.");
      }

      const payload = JSON.parse(init.body) as Record<string, unknown>;
      submittedPayloads.push(payload);

      if (payload.assetType !== AssetType.REAL_ESTATE) {
        return Response.json(
          {
            error:
              "assetType must be one of: STOCK, ETF, FUND, CASH_EQUIVALENT, OTHER.",
          },
          { status: 400 },
        );
      }

      return Response.json({
        asset: {
          id: "asset-house",
          name: payload.name,
          assetType: payload.assetType,
          symbol: null,
          currency: payload.currency,
          priceSourceType: payload.priceSourceType,
          isActive: true,
          notes: null,
        },
      });
    }

    throw new Error(`Unexpected fetch request: ${url}`);
  }) as typeof fetch;

  try {
    await act(async () => {
      root.render(
        <WorkspaceMutationBoundary>
          <ManagementSection section="assets" />
        </WorkspaceMutationBoundary>,
      );
      await Promise.resolve();
    });
    await flushEffects();

    assert.match(document.body.textContent ?? "", /House/);

    const editButton = document.querySelector<HTMLButtonElement>(".asset-card-edit-button");
    assert.ok(editButton);

    await act(async () => {
      editButton.click();
    });

    const form = document.querySelector("form");
    const assetTypeSelect = getFieldControl<HTMLSelectElement>(document, "Asset type");
    const priceSourceSelect = getFieldControl<HTMLSelectElement>(document, "Price source");
    const submitButton = document.querySelector<HTMLButtonElement>('button[type="submit"]');

    assert.ok(form);
    assert.ok(assetTypeSelect);
    assert.ok(priceSourceSelect);
    assert.ok(submitButton);
    assert.ok(
      Array.from(assetTypeSelect.options).some(
        (option) => option.value === AssetType.REAL_ESTATE && option.text === "Real Estate",
      ),
    );

    await act(async () => {
      changeSelect(assetTypeSelect, AssetType.REAL_ESTATE);
      changeSelect(priceSourceSelect, AssetPriceSourceType.MANUAL);
      await Promise.resolve();
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flushEffects();

    assert.deepEqual(submittedPayloads, [
      {
        name: "House",
        assetType: AssetType.REAL_ESTATE,
        symbol: "",
        currency: "TWD",
        priceSourceType: AssetPriceSourceType.MANUAL,
        isActive: true,
        notes: "",
      },
    ]);
    const houseCard = getResourceCardByHeading(document, "House");
    assert.match(houseCard.textContent ?? "", /Real Estate/);
    assert.doesNotMatch(
      document.body.textContent ?? "",
      /assetType must be one of: STOCK, ETF, FUND, CASH_EQUIVALENT, OTHER\./,
    );
  } finally {
    globalThis.fetch = previousFetch;
    await unmount(root);
    restore();
  }
});

test("asset symbol guidance only appears for auto-priced assets", () => {
  assert.equal(
    getAssetSymbolGuidance(AssetPriceSourceType.AUTO),
    "Use the Yahoo Finance symbol format, for example AAPL or 2330.TW.",
  );
  assert.equal(getAssetSymbolGuidance(AssetPriceSourceType.MANUAL), null);

  const autoMarkup = renderToStaticMarkup(
    <AssetSymbolGuidance priceSourceType={AssetPriceSourceType.AUTO} />,
  );
  const manualMarkup = renderToStaticMarkup(
    <AssetSymbolGuidance priceSourceType={AssetPriceSourceType.MANUAL} />,
  );

  assert.match(autoMarkup, /Yahoo Finance symbol format/);
  assert.equal(manualMarkup, "");
});

test("formatCurrencyAmount falls back safely when the currency code is invalid", () => {
  assert.equal(formatCurrencyAmount("1234.50", "INVALID!"), "INVALID! 1234.50");
});

test("getAccountActionLabel includes institution context for duplicate account names", () => {
  const account = {
    name: "Checking",
    institutionName: "North Bank",
  };

  assert.equal(getAccountActionLabel(account, "edit"), "Edit Checking at North Bank");
  assert.equal(
    getAccountActionLabel(account, "archive"),
    "Archive Checking at North Bank",
  );
  assert.equal(
    getAccountActionLabel(account, "activate"),
    "Mark Checking at North Bank active",
  );
});

test("account cards expose archive actions and inactive-state rendering", () => {
  const activeMarkup = renderToStaticMarkup(
    <AccountRecordCard
      account={{
        id: "account-1",
        name: "Checking",
        institutionName: "North Bank",
        accountType: AccountType.BANK,
        currency: "USD",
        cashBalance: "1200.50",
        isActive: true,
        notes: null,
      }}
      isUpdating={false}
      onEdit={() => undefined}
      onToggleStatus={() => undefined}
    />,
  );

  assert.match(activeMarkup, /Checking/);
  assert.match(activeMarkup, /North Bank/);
  assert.match(activeMarkup, /Active/);
  assert.match(activeMarkup, /Archive/);
  assert.match(activeMarkup, /aria-label="Archive Checking at North Bank"/);

  const inactiveMarkup = renderToStaticMarkup(
    <AccountRecordCard
      account={{
        id: "account-1",
        name: "Checking",
        institutionName: "North Bank",
        accountType: AccountType.BANK,
        currency: "USD",
        cashBalance: "1200.50",
        isActive: false,
        notes: null,
      }}
      isUpdating={false}
      onEdit={() => undefined}
      onToggleStatus={() => undefined}
    />,
  );

  assert.match(inactiveMarkup, /Inactive/);
  assert.match(inactiveMarkup, /Mark active/);
  assert.doesNotMatch(inactiveMarkup, /Archived/);
});

test("asset card edit action uses asset-specific black text class", () => {
  const markup = renderToStaticMarkup(
    <AssetRecordCard
      asset={{
        id: "asset-1",
        name: "Brokerage Fund",
        assetType: AssetType.FUND,
        symbol: "BFINX",
        currency: "USD",
        priceSourceType: AssetPriceSourceType.AUTO,
        isActive: true,
        notes: null,
      }}
      onEdit={() => undefined}
    />,
  );

  assert.match(markup, /Brokerage Fund/);
  assert.match(markup, /class="ghost-button compact-button asset-card-edit-button"/);
});
