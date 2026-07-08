import assert from "node:assert/strict";
import test from "node:test";

import { AccountType, AssetType, LiabilityType, Prisma } from "@prisma/client";

import {
  buildSnapshotCreateInput,
  confirmSnapshotFromPreviewInput,
  createSnapshotPreviewHash,
} from "./service";
import { createSnapshotRepository } from "./repository";

function asCreateArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

test("buildSnapshotCreateInput keeps immutable snapshot details from preview input", () => {
  const snapshot = buildSnapshotCreateInput("user-1", {
    generatedAt: "2026-07-07T12:00:00Z",
    baseCurrency: "TWD",
    fxRates: [
      { currency: "TWD", rateToBase: "1" },
      { currency: "USD", rateToBase: "30" },
    ],
    accounts: [
      {
        sourceAccountId: "account-1",
        accountName: "Brokerage",
        institutionName: "My Broker",
        accountType: AccountType.BROKERAGE,
        currency: "TWD",
        cashBalance: "100",
      },
    ],
    holdings: [
      {
        sourceHoldingId: "holding-1",
        sourceAccountId: "account-1",
        sourceAssetId: "asset-1",
        accountName: "Brokerage",
        assetName: "Global ETF",
        assetType: AssetType.ETF,
        symbol: "VT",
        quantity: "2",
        assetCurrency: "USD",
        priceAmount: "10",
        priceCurrency: "USD",
        priceRecordedAt: "2026-07-07T10:00:00Z",
      },
    ],
    liabilities: [
      {
        sourceLiabilityId: "liability-1",
        liabilityName: "Mortgage",
        liabilityType: LiabilityType.MORTGAGE,
        currency: "USD",
        currentBalance: "5",
        monthlyPayment: "1",
        paymentAccountName: null,
      },
    ],
  });

  assert.equal(snapshot.status, "COMPLETE");
  assert.equal(snapshot.totalAssets.toString(), "700.00");
  assert.equal(snapshot.totalLiabilities.toString(), "150.00");
  assert.equal(snapshot.netWorth.toString(), "550.00");
  assert.equal(
    (snapshot.snapshotAt as Date).toISOString(),
    "2026-07-07T12:00:00.000Z",
  );
  assert.equal(
    snapshot.previewHash,
    createSnapshotPreviewHash({
      generatedAt: "2026-07-07T12:00:00.000Z",
      baseCurrency: "TWD",
      fxRates: [
        { currency: "TWD", rateToBase: "1" },
        { currency: "USD", rateToBase: "30" },
      ],
      accounts: [
        {
          sourceAccountId: "account-1",
          accountName: "Brokerage",
          institutionName: "My Broker",
          accountType: AccountType.BROKERAGE,
          currency: "TWD",
          cashBalance: "100",
        },
      ],
      holdings: [
        {
          sourceHoldingId: "holding-1",
          sourceAccountId: "account-1",
          sourceAssetId: "asset-1",
          accountName: "Brokerage",
          assetName: "Global ETF",
          assetType: AssetType.ETF,
          symbol: "VT",
          quantity: "2",
          assetCurrency: "USD",
          priceAmount: "10",
          priceCurrency: "USD",
          priceRecordedAt: "2026-07-07T10:00:00Z",
        },
      ],
      liabilities: [
        {
          sourceLiabilityId: "liability-1",
          liabilityName: "Mortgage",
          liabilityType: LiabilityType.MORTGAGE,
          currency: "USD",
          currentBalance: "5",
          monthlyPayment: "1",
          paymentAccountName: null,
        },
      ],
    }),
  );
  const accountCreates = asCreateArray(snapshot.accounts?.create);
  const holdingCreates = asCreateArray(snapshot.holdings?.create);
  const liabilityCreates = asCreateArray(snapshot.liabilities?.create);
  const issueCreates = asCreateArray(snapshot.issues?.create);

  assert.equal(accountCreates[0]?.accountType, AccountType.BROKERAGE);
  assert.equal(holdingCreates[0]?.assetType, AssetType.ETF);
  assert.equal(
    (holdingCreates[0]?.priceRecordedAt as Date | undefined)?.toISOString(),
    "2026-07-07T10:00:00.000Z",
  );
  assert.equal(liabilityCreates[0]?.liabilityType, LiabilityType.MORTGAGE);
  assert.equal(issueCreates.length, 0);
});

test("confirmSnapshotFromPreviewInput preserves incomplete snapshots with explicit issues", async () => {
  let capturedInput: Prisma.SnapshotCreateInput | null = null;

  const createdSnapshot = {
    id: "snapshot-1",
    status: "INCOMPLETE",
    issues: [{ id: "issue-1", message: "Missing valid price record for Private Fund." }],
  } as unknown as Awaited<
    ReturnType<ReturnType<typeof createSnapshotRepository>["createWithDetails"]>
  >;

  const snapshot = await confirmSnapshotFromPreviewInput(
    "user-1",
    {
      generatedAt: "2026-07-07T12:00:00Z",
      baseCurrency: "TWD",
      fxRates: [{ currency: "TWD", rateToBase: "1" }],
      accounts: [
        {
          sourceAccountId: "account-1",
          accountName: "USD Cash",
          institutionName: "My Bank",
          accountType: AccountType.BANK,
          currency: "USD",
          cashBalance: "50",
        },
      ],
      holdings: [
        {
          sourceHoldingId: "holding-1",
          sourceAccountId: "account-1",
          sourceAssetId: "asset-1",
          accountName: "USD Cash",
          assetName: "Private Fund",
          assetType: AssetType.FUND,
          symbol: null,
          quantity: "3",
          assetCurrency: "USD",
          priceAmount: null,
          priceCurrency: null,
          priceRecordedAt: null,
        },
      ],
      liabilities: [
        {
          sourceLiabilityId: "liability-1",
          liabilityName: "EUR Loan",
          liabilityType: LiabilityType.PERSONAL_LOAN,
          currency: "EUR",
          currentBalance: "10",
          monthlyPayment: "2",
          paymentAccountName: null,
        },
      ],
    },
    {
      async createWithDetails(input) {
        capturedInput = input;
        return createdSnapshot;
      },
      async findByPreviewHash() {
        return null;
      },
    },
  );

  assert.equal(snapshot, createdSnapshot);
  if (!capturedInput) {
    throw new Error("Expected captured input.");
  }

  const finalInput = capturedInput as Prisma.SnapshotCreateInput;
  const capturedHoldingCreates = asCreateArray(finalInput.holdings?.create);
  const capturedLiabilityCreates = asCreateArray(finalInput.liabilities?.create);
  const capturedIssueCreates = asCreateArray(finalInput.issues?.create);

  assert.equal(finalInput.status, "INCOMPLETE");
  assert.equal(capturedHoldingCreates[0]?.priceAmount, undefined);
  assert.equal(capturedHoldingCreates[0]?.priceCurrency, undefined);
  assert.equal(capturedHoldingCreates[0]?.fxRateToBase, undefined);
  assert.equal(capturedLiabilityCreates[0]?.fxRateToBase, undefined);
  assert.equal(capturedIssueCreates.length, 3);
});

test("confirmSnapshotFromPreviewInput returns the existing snapshot when the same preview is confirmed twice", async () => {
  const previewInput = {
    generatedAt: "2026-07-07T12:00:00Z",
    baseCurrency: "TWD",
    fxRates: [{ currency: "TWD", rateToBase: "1" }],
    accounts: [],
    holdings: [],
    liabilities: [],
  };
  const existingSnapshot = {
    id: "snapshot-1",
    previewHash: createSnapshotPreviewHash(previewInput),
  } as unknown as Awaited<
    ReturnType<ReturnType<typeof createSnapshotRepository>["createWithDetails"]>
  >;

  const snapshot = await confirmSnapshotFromPreviewInput("user-1", previewInput, {
    async createWithDetails() {
      throw new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      });
    },
    async findByPreviewHash() {
      return existingSnapshot;
    },
  });

  assert.equal(snapshot, existingSnapshot);
});
