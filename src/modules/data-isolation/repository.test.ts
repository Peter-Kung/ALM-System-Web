import assert from "node:assert/strict";
import test from "node:test";

import { createAccountRepository } from "@/modules/accounts";
import { createAssetRepository } from "@/modules/assets";
import { createHoldingRepository } from "@/modules/holdings";
import { createLiabilityRepository } from "@/modules/liabilities";
import { createPriceRecordRepository } from "@/modules/prices/repository";
import { createSnapshotRepository } from "@/modules/snapshots";

function createFindManySpy(calls: unknown[]) {
  return async (args: unknown) => {
    calls.push(args);
    return [];
  };
}

test("financial repositories scope list reads by user id", async () => {
  const accountCalls: unknown[] = [];
  const assetCalls: unknown[] = [];
  const holdingCalls: unknown[] = [];
  const liabilityCalls: unknown[] = [];
  const priceRecordCalls: unknown[] = [];
  const snapshotCalls: unknown[] = [];
  const snapshotTrendCalls: unknown[] = [];
  const db = {
    account: { findMany: createFindManySpy(accountCalls) },
    asset: { findMany: createFindManySpy(assetCalls) },
    holding: { findMany: createFindManySpy(holdingCalls) },
    liability: { findMany: createFindManySpy(liabilityCalls) },
    priceRecord: { findMany: createFindManySpy(priceRecordCalls) },
    snapshot: {
      findMany: async (args: unknown) => {
        const query = args as { select?: unknown };

        if (query.select) {
          snapshotTrendCalls.push(args);
        } else {
          snapshotCalls.push(args);
        }

        return [];
      },
    },
  };
  const executor = db as never;
  const since = new Date("2026-07-01T00:00:00.000Z");

  await createAccountRepository(executor).listByUser("user-b");
  await createAssetRepository(executor).listByUser("user-b");
  await createHoldingRepository(executor).listByUser("user-b");
  await createLiabilityRepository(executor).listByUser("user-b");
  await createPriceRecordRepository(executor).listLatestByUser("user-b");
  await createSnapshotRepository(executor).listByUser("user-b", { take: 1 });
  await createSnapshotRepository(executor).listTrendByUser("user-b", { since });

  assert.equal(accountCalls.length, 1);
  assert.equal(assetCalls.length, 1);
  assert.equal(holdingCalls.length, 1);
  assert.equal(liabilityCalls.length, 1);
  assert.equal(priceRecordCalls.length, 1);
  assert.equal(snapshotCalls.length, 1);
  assert.equal(snapshotTrendCalls.length, 1);
  assert.deepEqual(accountCalls[0], {
    where: { userId: "user-b" },
    include: { holdings: true, paymentLiabilities: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(assetCalls[0], {
    where: { userId: "user-b" },
    include: { holdings: true, priceRecords: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(holdingCalls[0], {
    where: { account: { userId: "user-b" } },
    include: { account: true, asset: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(liabilityCalls[0], {
    where: { userId: "user-b" },
    include: { paymentAccount: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(priceRecordCalls[0], {
    where: { asset: { userId: "user-b" } },
    include: { asset: true },
    orderBy: [
      { assetId: "asc" },
      { recordedAt: "desc" },
      { createdAt: "desc" },
    ],
  });
  assert.deepEqual(snapshotCalls[0], {
    where: { userId: "user-b" },
    include: {
      accounts: true,
      holdings: true,
      liabilities: true,
      issues: true,
    },
    orderBy: [
      { snapshotAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: 1,
  });
  assert.deepEqual(snapshotTrendCalls[0], {
    where: { userId: "user-b", snapshotAt: { gte: since } },
    select: {
      id: true,
      snapshotAt: true,
      createdAt: true,
      totalAssets: true,
      totalLiabilities: true,
      netWorth: true,
      monthlyDebtPaymentTotal: true,
    },
    orderBy: [
      { snapshotAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
});
