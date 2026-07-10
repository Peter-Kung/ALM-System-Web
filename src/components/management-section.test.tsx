import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
