import test from "node:test";
import assert from "node:assert/strict";

import {
  AccountType,
  AssetPriceSourceType,
  AssetType,
  LiabilityType,
  PriceRecordSourceType,
  Prisma,
} from "@prisma/client";

import { buildValuationPreview } from "./service";
import { collectRequiredFxCurrencies } from "./service";

test("buildValuationPreview returns a complete preview when prices and FX rates are present", () => {
  const preview = buildValuationPreview({
    accounts: [
      {
        id: "account-1",
        userId: "user-1",
        name: "Brokerage",
        institutionName: "My Broker",
        accountType: AccountType.BROKERAGE,
        currency: "TWD",
        cashBalance: new Prisma.Decimal("100"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
      },
    ],
    holdings: [
      {
        id: "holding-1",
        accountId: "account-1",
        assetId: "asset-1",
        quantity: new Prisma.Decimal("2"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        account: {
          id: "account-1",
          name: "Brokerage",
          institutionName: "My Broker",
          currency: "TWD",
          isActive: true,
        },
        asset: {
          id: "asset-1",
          name: "Global ETF",
          assetType: AssetType.ETF,
          symbol: "VT",
          currency: "USD",
          isActive: true,
        },
      },
    ],
    liabilities: [
      {
        id: "liability-1",
        userId: "user-1",
        name: "Mortgage",
        liabilityType: LiabilityType.MORTGAGE,
        currency: "USD",
        originalAmount: new Prisma.Decimal("10"),
        currentBalance: new Prisma.Decimal("5"),
        interestRate: new Prisma.Decimal("2.1"),
        monthlyPayment: new Prisma.Decimal("1"),
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: null,
        paymentAccountId: null,
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        paymentAccount: null,
      },
    ],
    latestPriceRecords: [
      {
        id: "price-1",
        assetId: "asset-1",
        sourceType: PriceRecordSourceType.AUTO_REFRESH,
        currency: "USD",
        price: new Prisma.Decimal("10"),
        recordedAt: new Date("2026-07-07T00:00:00Z"),
        isValid: true,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        asset: { id: "asset-1" },
      },
    ],
    fxRates: {
      USD: "30",
    },
    generatedAt: new Date("2026-07-07T12:00:00Z"),
  });

  assert.equal(preview.status, "COMPLETE");
  assert.equal(preview.totalAssets, "700.00");
  assert.equal(preview.totalLiabilities, "150.00");
  assert.equal(preview.netWorth, "550.00");
  assert.equal(preview.cashPosition, "100.00");
  assert.equal(preview.investmentValue, "600.00");
  assert.equal(preview.monthlyDebtPaymentTotal, "30.00");
  assert.deepEqual(preview.issues, []);
  assert.equal(preview.previewInput.fxRates.length, 2);
  assert.equal(preview.previewInput.holdings[0]?.priceAmount, "10");
});

test("buildValuationPreview preserves real estate asset classification", () => {
  const preview = buildValuationPreview({
    accounts: [
      {
        id: "account-1",
        userId: "user-1",
        name: "Property Account",
        institutionName: "Personal",
        accountType: AccountType.OTHER,
        currency: "TWD",
        cashBalance: new Prisma.Decimal("0"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
      },
    ],
    holdings: [
      {
        id: "holding-1",
        accountId: "account-1",
        assetId: "asset-1",
        quantity: new Prisma.Decimal("1"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        account: {
          id: "account-1",
          name: "Property Account",
          institutionName: "Personal",
          currency: "TWD",
          isActive: true,
        },
        asset: {
          id: "asset-1",
          name: "Home",
          assetType: AssetType.REAL_ESTATE,
          symbol: null,
          currency: "TWD",
          isActive: true,
        },
      },
    ],
    liabilities: [],
    latestPriceRecords: [
      {
        id: "price-1",
        assetId: "asset-1",
        sourceType: PriceRecordSourceType.MANUAL_ENTRY,
        currency: "TWD",
        price: new Prisma.Decimal("12000000"),
        recordedAt: new Date("2026-07-07T00:00:00Z"),
        isValid: true,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        asset: { id: "asset-1" },
      },
    ],
    fxRates: {},
    generatedAt: new Date("2026-07-07T12:00:00Z"),
  });

  assert.equal(preview.status, "COMPLETE");
  assert.equal(preview.totalAssets, "12000000.00");
  assert.equal(preview.holdings[0]?.assetType, AssetType.REAL_ESTATE);
  assert.equal(preview.previewInput.holdings[0]?.assetType, AssetType.REAL_ESTATE);
});

test("buildValuationPreview reports missing price and FX inputs as incomplete", () => {
  const preview = buildValuationPreview({
    accounts: [
      {
        id: "account-1",
        userId: "user-1",
        name: "USD Cash",
        institutionName: "My Bank",
        accountType: AccountType.BANK,
        currency: "USD",
        cashBalance: new Prisma.Decimal("50"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
      },
    ],
    holdings: [
      {
        id: "holding-1",
        accountId: "account-1",
        assetId: "asset-1",
        quantity: new Prisma.Decimal("3"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        account: {
          id: "account-1",
          name: "USD Cash",
          institutionName: "My Bank",
          currency: "USD",
          isActive: true,
        },
        asset: {
          id: "asset-1",
          name: "Private Fund",
          assetType: AssetType.FUND,
          symbol: null,
          currency: "USD",
          isActive: true,
        },
      },
    ],
    liabilities: [
      {
        id: "liability-1",
        userId: "user-1",
        name: "EUR Loan",
        liabilityType: LiabilityType.PERSONAL_LOAN,
        currency: "EUR",
        originalAmount: new Prisma.Decimal("20"),
        currentBalance: new Prisma.Decimal("10"),
        interestRate: new Prisma.Decimal("3"),
        monthlyPayment: new Prisma.Decimal("2"),
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: null,
        paymentAccountId: null,
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        paymentAccount: null,
      },
    ],
    latestPriceRecords: [],
    fxRates: {},
    generatedAt: new Date("2026-07-07T12:00:00Z"),
  });

  assert.equal(preview.status, "INCOMPLETE");
  assert.equal(preview.totalAssets, "0.00");
  assert.equal(preview.totalLiabilities, "0.00");
  assert.equal(preview.netWorth, "0.00");
  assert.equal(preview.issues.length, 3);
  assert.deepEqual(
    preview.issues.map((issue) => issue.issueType).sort(),
    ["MISSING_FX_RATE", "MISSING_FX_RATE", "MISSING_PRICE"].sort(),
  );
  assert.equal(preview.holdings[0]?.priceAmount, null);
  assert.equal(preview.liabilities[0]?.fxRateToBase, null);
});

test("collectRequiredFxCurrencies uses the latest valid price for active holdings", () => {
  const currencies = collectRequiredFxCurrencies({
    accounts: [],
    holdings: [
      {
        id: "holding-1",
        accountId: "account-1",
        assetId: "asset-1",
        quantity: new Prisma.Decimal("1"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        account: {
          id: "account-1",
          name: "Brokerage",
          institutionName: "My Broker",
          currency: "TWD",
          isActive: true,
        },
        asset: {
          id: "asset-1",
          name: "Global ETF",
          assetType: AssetType.ETF,
          symbol: "VT",
          currency: "USD",
          isActive: true,
        },
      },
    ],
    liabilities: [],
    latestPriceRecords: [
      {
        id: "price-invalid",
        assetId: "asset-1",
        sourceType: PriceRecordSourceType.AUTO_REFRESH,
        currency: "JPY",
        price: new Prisma.Decimal("100"),
        recordedAt: new Date("2026-07-08T00:00:00Z"),
        isValid: false,
        createdAt: new Date("2026-07-08T00:00:00Z"),
        asset: { id: "asset-1" },
      },
      {
        id: "price-valid",
        assetId: "asset-1",
        sourceType: PriceRecordSourceType.AUTO_REFRESH,
        currency: "USD",
        price: new Prisma.Decimal("10"),
        recordedAt: new Date("2026-07-07T00:00:00Z"),
        isValid: true,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        asset: { id: "asset-1" },
      },
    ],
  });

  assert.deepEqual(currencies, ["USD"]);
});

test("buildValuationPreview keeps account holdings totals aligned with the summary", () => {
  const preview = buildValuationPreview({
    accounts: [
      {
        id: "account-1",
        userId: "user-1",
        name: "Brokerage",
        institutionName: "My Broker",
        accountType: AccountType.BROKERAGE,
        currency: "TWD",
        cashBalance: new Prisma.Decimal("0"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
      },
    ],
    holdings: [
      {
        id: "holding-1",
        accountId: "account-1",
        assetId: "asset-1",
        quantity: new Prisma.Decimal("1"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        account: {
          id: "account-1",
          name: "Brokerage",
          institutionName: "My Broker",
          currency: "TWD",
          isActive: true,
        },
        asset: {
          id: "asset-1",
          name: "ETF One",
          assetType: AssetType.ETF,
          symbol: "ONE",
          currency: "USD",
          isActive: true,
        },
      },
      {
        id: "holding-2",
        accountId: "account-1",
        assetId: "asset-2",
        quantity: new Prisma.Decimal("1"),
        isActive: true,
        notes: null,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        updatedAt: new Date("2026-07-07T00:00:00Z"),
        account: {
          id: "account-1",
          name: "Brokerage",
          institutionName: "My Broker",
          currency: "TWD",
          isActive: true,
        },
        asset: {
          id: "asset-2",
          name: "ETF Two",
          assetType: AssetType.ETF,
          symbol: "TWO",
          currency: "USD",
          isActive: true,
        },
      },
    ],
    liabilities: [],
    latestPriceRecords: [
      {
        id: "price-1",
        assetId: "asset-1",
        sourceType: PriceRecordSourceType.AUTO_REFRESH,
        currency: "USD",
        price: new Prisma.Decimal("0.015"),
        recordedAt: new Date("2026-07-07T00:00:00Z"),
        isValid: true,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        asset: { id: "asset-1" },
      },
      {
        id: "price-2",
        assetId: "asset-2",
        sourceType: PriceRecordSourceType.AUTO_REFRESH,
        currency: "USD",
        price: new Prisma.Decimal("0.015"),
        recordedAt: new Date("2026-07-07T00:00:00Z"),
        isValid: true,
        createdAt: new Date("2026-07-07T00:00:00Z"),
        asset: { id: "asset-2" },
      },
    ],
    fxRates: { USD: "1" },
  });

  assert.equal(preview.investmentValue, "0.03");
  assert.equal(preview.accounts[0]?.holdingsValue, "0.03");
  assert.equal(preview.accounts[0]?.totalValue, "0.03");
});
