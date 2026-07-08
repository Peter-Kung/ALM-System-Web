import {
  AccountType,
  AssetType,
  LiabilityType,
  Prisma,
  SnapshotEntityType,
  SnapshotIssueSeverity,
  SnapshotIssueType,
  SnapshotStatus,
  type Prisma as PrismaNamespace,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { RepositoryValidationError } from "@/lib/repository-utils";
import { createSnapshotRepository } from "@/modules/snapshots/repository";
import {
  VALUATION_BASE_CURRENCY,
  type ValuationPreviewInput,
  type ValuationPreviewIssue,
  type ValuationPreviewResult,
} from "@/modules/valuation/types";

type SnapshotRepository = Pick<
  ReturnType<typeof createSnapshotRepository>,
  never
> & {
  createWithDetails(
    data: PrismaNamespace.SnapshotCreateInput,
  ): PromiseLike<
    Awaited<ReturnType<ReturnType<typeof createSnapshotRepository>["createWithDetails"]>>
  >;
  findByPreviewHash(
    userId: string,
    previewHash: string,
  ): PromiseLike<
    Awaited<ReturnType<ReturnType<typeof createSnapshotRepository>["findByPreviewHash"]>>
  >;
};

function toDecimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function toDecimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function parseDate(value: string, fieldName: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RepositoryValidationError(`${fieldName} must be a valid ISO date.`);
  }

  return date;
}

function parseEnumValue<T extends string>(
  value: string,
  values: readonly T[],
  fieldName: string,
) {
  if (!values.includes(value as T)) {
    throw new RepositoryValidationError(
      `${fieldName} must be one of: ${values.join(", ")}.`,
    );
  }

  return value as T;
}

function createIssue(
  issues: ValuationPreviewIssue[],
  issue: ValuationPreviewIssue,
) {
  issues.push(issue);
}

function buildFxRateMap(previewInput: ValuationPreviewInput) {
  const baseCurrency = normalizeCurrency(previewInput.baseCurrency || VALUATION_BASE_CURRENCY);
  const rateMap = new Map<string, Prisma.Decimal>([[baseCurrency, toDecimal(1)]]);

  for (const rate of previewInput.fxRates) {
    const currency = normalizeCurrency(rate.currency);

    if (!currency) {
      continue;
    }

    let decimalRate: Prisma.Decimal;

    try {
      decimalRate = toDecimal(rate.rateToBase);
    } catch {
      throw new RepositoryValidationError(
        `FX rate for ${currency} must be a valid number.`,
      );
    }

    if (decimalRate.lte(0)) {
      throw new RepositoryValidationError(
        `FX rate for ${currency} must be greater than zero.`,
      );
    }

    rateMap.set(currency, decimalRate);
  }

  return { baseCurrency, rateMap };
}

function resolveFxRate(
  currency: string,
  rateMap: Map<string, Prisma.Decimal>,
) {
  return rateMap.get(normalizeCurrency(currency)) ?? null;
}

function buildPreviewFromInput(previewInput: ValuationPreviewInput): ValuationPreviewResult {
  const generatedAt = parseDate(previewInput.generatedAt, "previewInput.generatedAt");
  const { baseCurrency, rateMap } = buildFxRateMap(previewInput);
  const issues: ValuationPreviewIssue[] = [];
  const holdingsByAccountId = new Map<string, Prisma.Decimal>();
  let cashPosition = toDecimal(0);
  let investmentValue = toDecimal(0);
  let totalLiabilities = toDecimal(0);
  let monthlyDebtPaymentTotal = toDecimal(0);

  const holdings = previewInput.holdings.map((holding) => {
    const quantity = toDecimal(holding.quantity);
    const priceAmount = holding.priceAmount ? toDecimal(holding.priceAmount) : null;
    const priceCurrency = holding.priceCurrency
      ? normalizeCurrency(holding.priceCurrency)
      : null;
    const fxRate = priceCurrency ? resolveFxRate(priceCurrency, rateMap) : null;
    let marketValue = toDecimal(0);

    if (!priceAmount || !priceCurrency) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_PRICE,
        affectedEntityType: SnapshotEntityType.ASSET,
        affectedEntityId: holding.sourceAssetId,
        message: `Missing valid price record for ${holding.assetName}.`,
      });
    } else if (!fxRate) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_FX_RATE,
        affectedEntityType: SnapshotEntityType.HOLDING,
        affectedEntityId: holding.sourceHoldingId,
        message: `Missing FX rate to ${baseCurrency} for holding ${holding.assetName} priced in ${priceCurrency}.`,
      });
    } else {
      marketValue = quantity.mul(priceAmount).mul(fxRate);
      investmentValue = investmentValue.add(marketValue);
      holdingsByAccountId.set(
        holding.sourceAccountId,
        (holdingsByAccountId.get(holding.sourceAccountId) ?? toDecimal(0)).add(
          marketValue,
        ),
      );
    }

    return {
      ...holding,
      assetCurrency: normalizeCurrency(holding.assetCurrency),
      priceCurrency,
      priceAmount: priceAmount?.toString() ?? null,
      fxRateToBase: fxRate?.toString() ?? null,
      marketValue: toDecimalString(marketValue),
    };
  });

  const accounts = previewInput.accounts.map((account) => {
    const cashBalance = toDecimal(account.cashBalance);
    const fxRate = resolveFxRate(account.currency, rateMap);
    let cashValue = toDecimal(0);

    if (!fxRate) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_FX_RATE,
        affectedEntityType: SnapshotEntityType.ACCOUNT,
        affectedEntityId: account.sourceAccountId,
        message: `Missing FX rate to ${baseCurrency} for account ${account.accountName} in ${normalizeCurrency(account.currency)}.`,
      });
    } else {
      cashValue = cashBalance.mul(fxRate);
      cashPosition = cashPosition.add(cashValue);
    }

    const holdingsValue = holdingsByAccountId.get(account.sourceAccountId) ?? toDecimal(0);
    const totalValue = cashValue.add(holdingsValue);

    return {
      ...account,
      currency: normalizeCurrency(account.currency),
      cashBalance: cashBalance.toString(),
      cashValue: toDecimalString(cashValue),
      holdingsValue: toDecimalString(holdingsValue),
      totalValue: toDecimalString(totalValue),
    };
  });

  const liabilities = previewInput.liabilities.map((liability) => {
    const currentBalance = toDecimal(liability.currentBalance);
    const monthlyPayment = toDecimal(liability.monthlyPayment);
    const fxRate = resolveFxRate(liability.currency, rateMap);
    let balanceValue = toDecimal(0);
    let monthlyPaymentValue = toDecimal(0);

    if (!fxRate) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_FX_RATE,
        affectedEntityType: SnapshotEntityType.LIABILITY,
        affectedEntityId: liability.sourceLiabilityId,
        message: `Missing FX rate to ${baseCurrency} for liability ${liability.liabilityName} in ${normalizeCurrency(liability.currency)}.`,
      });
    } else {
      balanceValue = currentBalance.mul(fxRate);
      monthlyPaymentValue = monthlyPayment.mul(fxRate);
      totalLiabilities = totalLiabilities.add(balanceValue);
      monthlyDebtPaymentTotal = monthlyDebtPaymentTotal.add(monthlyPaymentValue);
    }

    return {
      ...liability,
      currency: normalizeCurrency(liability.currency),
      currentBalance: currentBalance.toString(),
      monthlyPayment: monthlyPayment.toString(),
      fxRateToBase: fxRate?.toString() ?? null,
      balanceValue: toDecimalString(balanceValue),
      monthlyPaymentValue: toDecimalString(monthlyPaymentValue),
    };
  });

  const totalAssets = cashPosition.add(investmentValue);
  const netWorth = totalAssets.sub(totalLiabilities);
  const status = issues.length > 0 ? SnapshotStatus.INCOMPLETE : SnapshotStatus.COMPLETE;

  return {
    status,
    baseCurrency,
    generatedAt: generatedAt.toISOString(),
    totalAssets: toDecimalString(totalAssets),
    totalLiabilities: toDecimalString(totalLiabilities),
    netWorth: toDecimalString(netWorth),
    cashPosition: toDecimalString(cashPosition),
    investmentValue: toDecimalString(investmentValue),
    monthlyDebtPaymentTotal: toDecimalString(monthlyDebtPaymentTotal),
    accounts,
    holdings,
    liabilities,
    issues,
    previewInput: {
      generatedAt: generatedAt.toISOString(),
      baseCurrency,
      fxRates: [...rateMap.entries()].map(([currency, rateToBase]) => ({
        currency,
        rateToBase: rateToBase.toString(),
      })),
      accounts: accounts.map((account) => ({
        sourceAccountId: account.sourceAccountId,
        accountName: account.accountName,
        institutionName: account.institutionName,
        accountType: account.accountType,
        currency: account.currency,
        cashBalance: account.cashBalance,
      })),
      holdings: holdings.map((holding) => ({
        sourceHoldingId: holding.sourceHoldingId,
        sourceAccountId: holding.sourceAccountId,
        sourceAssetId: holding.sourceAssetId,
        accountName: holding.accountName,
        assetName: holding.assetName,
        assetType: holding.assetType,
        symbol: holding.symbol,
        quantity: holding.quantity,
        assetCurrency: holding.assetCurrency,
        priceAmount: holding.priceAmount,
        priceCurrency: holding.priceCurrency,
        priceRecordedAt: holding.priceRecordedAt,
      })),
      liabilities: liabilities.map((liability) => ({
        sourceLiabilityId: liability.sourceLiabilityId,
        liabilityName: liability.liabilityName,
        liabilityType: liability.liabilityType,
        currency: liability.currency,
        currentBalance: liability.currentBalance,
        monthlyPayment: liability.monthlyPayment,
        paymentAccountName: liability.paymentAccountName,
      })),
    },
  };
}

export function createSnapshotPreviewHash(previewInput: ValuationPreviewInput) {
  return createHash("sha256")
    .update(JSON.stringify(previewInput))
    .digest("hex");
}

export function buildSnapshotCreateInput(
  userId: string,
  previewInput: ValuationPreviewInput,
): PrismaNamespace.SnapshotCreateInput {
  const preview = buildPreviewFromInput(previewInput);

  return {
    user: {
      connect: { id: userId },
    },
    previewHash: createSnapshotPreviewHash(preview.previewInput),
    status: preview.status,
    baseCurrency: preview.baseCurrency,
    totalAssets: preview.totalAssets,
    totalLiabilities: preview.totalLiabilities,
    netWorth: preview.netWorth,
    cashPosition: preview.cashPosition,
    investmentValue: preview.investmentValue,
    monthlyDebtPaymentTotal: preview.monthlyDebtPaymentTotal,
    snapshotAt: parseDate(preview.generatedAt, "previewInput.generatedAt"),
    accounts: {
      create: preview.accounts.map((account) => ({
        sourceAccountId: account.sourceAccountId,
        accountName: account.accountName,
        institutionName: account.institutionName,
        accountType: parseEnumValue(
          account.accountType,
          Object.values(AccountType),
          "previewInput.accounts.accountType",
        ),
        currency: account.currency,
        cashBalance: account.cashBalance,
        holdingsValue: account.holdingsValue,
        totalValue: account.totalValue,
      })),
    },
    holdings: {
      create: preview.holdings.map((holding) => ({
        sourceHoldingId: holding.sourceHoldingId,
        sourceAccountId: holding.sourceAccountId,
        sourceAssetId: holding.sourceAssetId,
        accountName: holding.accountName,
        assetName: holding.assetName,
        assetType: parseEnumValue(
          holding.assetType,
          Object.values(AssetType),
          "previewInput.holdings.assetType",
        ),
        symbol: holding.symbol,
        quantity: holding.quantity,
        assetCurrency: holding.assetCurrency,
        marketValue: holding.marketValue,
        ...(holding.priceAmount && holding.priceCurrency
          ? {
              priceAmount: holding.priceAmount,
              priceCurrency: holding.priceCurrency,
            }
          : {}),
        ...(holding.priceRecordedAt
          ? {
              priceRecordedAt: parseDate(
                holding.priceRecordedAt,
                "previewInput.holdings.priceRecordedAt",
              ),
            }
          : {}),
        ...(holding.fxRateToBase
          ? {
              fxRateToBase: holding.fxRateToBase,
            }
          : {}),
      })),
    },
    liabilities: {
      create: preview.liabilities.map((liability) => ({
        sourceLiabilityId: liability.sourceLiabilityId,
        liabilityName: liability.liabilityName,
        liabilityType: parseEnumValue(
          liability.liabilityType,
          Object.values(LiabilityType),
          "previewInput.liabilities.liabilityType",
        ),
        currency: liability.currency,
        currentBalance: liability.currentBalance,
        monthlyPayment: liability.monthlyPayment,
        balanceValue: liability.balanceValue,
        monthlyPaymentValue: liability.monthlyPaymentValue,
        paymentAccountName: liability.paymentAccountName,
        ...(liability.fxRateToBase
          ? {
              fxRateToBase: liability.fxRateToBase,
            }
          : {}),
      })),
    },
    issues: {
      create: preview.issues.map((issue) => ({
        severity: parseEnumValue(
          issue.severity,
          Object.values(SnapshotIssueSeverity),
          "previewInput.issues.severity",
        ),
        issueType: parseEnumValue(
          issue.issueType,
          Object.values(SnapshotIssueType),
          "previewInput.issues.issueType",
        ),
        affectedEntityType: parseEnumValue(
          issue.affectedEntityType,
          Object.values(SnapshotEntityType),
          "previewInput.issues.affectedEntityType",
        ),
        affectedEntityId: issue.affectedEntityId,
        message: issue.message,
      })),
    },
  };
}

export async function confirmSnapshotFromPreviewInput(
  userId: string,
  previewInput: ValuationPreviewInput,
  snapshotRepository: SnapshotRepository = createSnapshotRepository(),
) {
  const createInput = buildSnapshotCreateInput(userId, previewInput);

  try {
    return await snapshotRepository.createWithDetails(createInput);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      createInput.previewHash
    ) {
      const existingSnapshot = await snapshotRepository.findByPreviewHash(
        userId,
        createInput.previewHash,
      );

      if (existingSnapshot) {
        return existingSnapshot;
      }
    }

    throw error;
  }
}
