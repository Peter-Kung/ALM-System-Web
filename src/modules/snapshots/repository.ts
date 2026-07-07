import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertNonEmptyString,
  assertNonNegative,
  assertPositive,
} from "@/lib/repository-utils";

const snapshotInclude = {
  accounts: true,
  holdings: true,
  liabilities: true,
  issues: true,
} satisfies Prisma.SnapshotInclude;

function toArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function assertNoNestedDetails(data: Prisma.SnapshotUncheckedCreateInput) {
  if (data.accounts || data.holdings || data.liabilities || data.issues) {
    throw new Error(
      "Snapshot detail records must be created through createWithDetails.",
    );
  }
}

function getCreateOnlyNestedRecords<T>(
  nested:
    | { create?: T | T[]; createMany?: unknown; connect?: unknown }
    | undefined,
  relationName: string,
) {
  if (!nested) {
    return [];
  }

  const unsupportedOperation = Object.keys(nested).find((key) => key !== "create");

  if (unsupportedOperation) {
    throw new Error(
      `${relationName} only supports nested create operations in this repository.`,
    );
  }

  return toArray(nested.create);
}

function validateSnapshotTotals(data: {
  baseCurrency: string;
  totalAssets: unknown;
  totalLiabilities: unknown;
  cashPosition: unknown;
  investmentValue: unknown;
  monthlyDebtPaymentTotal: unknown;
}) {
  assertNonEmptyString(data.baseCurrency, "baseCurrency");
  assertNonNegative(data.totalAssets, "totalAssets");
  assertNonNegative(data.totalLiabilities, "totalLiabilities");
  assertNonNegative(data.cashPosition, "cashPosition");
  assertNonNegative(data.investmentValue, "investmentValue");
  assertNonNegative(data.monthlyDebtPaymentTotal, "monthlyDebtPaymentTotal");
}

function validateSnapshotCreateInput(data: Prisma.SnapshotUncheckedCreateInput) {
  assertNoNestedDetails(data);
  validateSnapshotTotals(data);
}

function validateSnapshotCreateWithDetailsInput(data: Prisma.SnapshotCreateInput) {
  validateSnapshotTotals(data);

  for (const account of getCreateOnlyNestedRecords(data.accounts, "accounts")) {
    assertNonEmptyString(account.accountName, "snapshotAccount.accountName");
    assertNonEmptyString(
      account.institutionName,
      "snapshotAccount.institutionName",
    );
    assertNonEmptyString(account.currency, "snapshotAccount.currency");
    assertNonNegative(account.cashBalance, "snapshotAccount.cashBalance");
    assertNonNegative(account.holdingsValue, "snapshotAccount.holdingsValue");
    assertNonNegative(account.totalValue, "snapshotAccount.totalValue");
  }

  for (const holding of getCreateOnlyNestedRecords(data.holdings, "holdings")) {
    assertNonEmptyString(holding.accountName, "snapshotHolding.accountName");
    assertNonEmptyString(holding.assetName, "snapshotHolding.assetName");
    assertNonEmptyString(
      holding.assetCurrency,
      "snapshotHolding.assetCurrency",
    );
    assertNonEmptyString(
      holding.priceCurrency,
      "snapshotHolding.priceCurrency",
    );
    assertPositive(holding.quantity, "snapshotHolding.quantity");
    assertPositive(holding.priceAmount, "snapshotHolding.priceAmount");
    assertPositive(holding.fxRateToBase, "snapshotHolding.fxRateToBase");
    assertNonNegative(holding.marketValue, "snapshotHolding.marketValue");
  }

  for (const liability of getCreateOnlyNestedRecords(
    data.liabilities,
    "liabilities",
  )) {
    assertNonEmptyString(
      liability.liabilityName,
      "snapshotLiability.liabilityName",
    );
    assertNonEmptyString(liability.currency, "snapshotLiability.currency");
    assertNonNegative(
      liability.currentBalance,
      "snapshotLiability.currentBalance",
    );
    assertNonNegative(
      liability.monthlyPayment,
      "snapshotLiability.monthlyPayment",
    );
    assertPositive(liability.fxRateToBase, "snapshotLiability.fxRateToBase");
    assertNonNegative(liability.balanceValue, "snapshotLiability.balanceValue");
    assertNonNegative(
      liability.monthlyPaymentValue,
      "snapshotLiability.monthlyPaymentValue",
    );
  }

  for (const issue of getCreateOnlyNestedRecords(data.issues, "issues")) {
    assertNonEmptyString(issue.message, "snapshotIssue.message");
  }
}

export function createSnapshotRepository(db: PrismaExecutor = prisma) {
  return {
    create(data: Prisma.SnapshotUncheckedCreateInput) {
      validateSnapshotCreateInput(data);

      return db.snapshot.create({
        data,
        include: snapshotInclude,
      });
    },
    createWithDetails(data: Prisma.SnapshotCreateInput) {
      validateSnapshotCreateWithDetailsInput(data);

      return db.snapshot.create({
        data,
        include: snapshotInclude,
      });
    },
    findById(id: string) {
      return db.snapshot.findUnique({
        where: { id },
        include: snapshotInclude,
      });
    },
    listByUser(userId: string) {
      return db.snapshot.findMany({
        where: { userId },
        include: snapshotInclude,
        orderBy: [{ snapshotAt: "desc" }, { createdAt: "desc" }],
      });
    },
  };
}
