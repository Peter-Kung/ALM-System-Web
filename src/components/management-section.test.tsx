import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AssetSymbolGuidance,
  ManagementSection,
  formatCurrencyAmount,
  getAssetSymbolGuidance,
  getAccountActionLabel,
} from "@/components/management-section";
import { AssetPriceSourceType } from "@prisma/client";

test("accounts management section renders the split editor and card-list template", () => {
  const markup = renderToStaticMarkup(<ManagementSection section="accounts" />);

  assert.match(markup, /Account management/);
  assert.match(markup, /Account editor/);
  assert.match(markup, /Account record list/);
  assert.match(markup, /Active accounts/);
  assert.match(markup, /Create account/);
  assert.match(markup, /Loading accounts\.\.\./);
  assert.match(markup, /management-grid management-grid-accounts/);
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
