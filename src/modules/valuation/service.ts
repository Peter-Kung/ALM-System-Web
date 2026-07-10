import {
  Prisma,
  SnapshotIssueSeverity,
  SnapshotIssueType,
  SnapshotStatus,
  SnapshotEntityType,
  type Account,
  type Asset,
  type Holding,
  type Liability,
  type PriceRecord,
} from "@prisma/client";

import { createAccountRepository } from "@/modules/accounts";
import { createHoldingRepository } from "@/modules/holdings";
import { createLiabilityRepository } from "@/modules/liabilities";
import { createPriceRecordRepository } from "@/modules/prices";
import { RepositoryValidationError } from "@/lib/repository-utils";
import { fetchFxRateToBase } from "@/modules/valuation/fx-rates";
import {
  VALUATION_BASE_CURRENCY,
  type ValuationContext,
  type ValuationFxRateResult,
  type ValuationPreviewIssue,
  type ValuationPreviewResult,
} from "@/modules/valuation/types";

type HoldingWithRelations = Holding & {
  account: Pick<Account, "id" | "name" | "institutionName" | "currency" | "isActive">;
  asset: Pick<Asset, "id" | "name" | "assetType" | "symbol" | "currency" | "isActive">;
};

type LiabilityWithPaymentAccount = Liability & {
  paymentAccount: Pick<Account, "name"> | null;
};

type PriceRecordWithAsset = PriceRecord & {
  asset: Pick<Asset, "id">;
};

type BuildValuationPreviewInput = {
  accounts: Account[];
  holdings: HoldingWithRelations[];
  liabilities: LiabilityWithPaymentAccount[];
  latestPriceRecords: PriceRecordWithAsset[];
  fxRates?: Record<string, string | number>;
  generatedAt?: Date;
  baseCurrency?: string;
};

type BuildValuationContextInput = {
  accounts: Account[];
  holdings: HoldingWithRelations[];
  liabilities: LiabilityWithPaymentAccount[];
  latestPriceRecords: PriceRecordWithAsset[];
  baseCurrency?: string;
  fetchFxRate?: (
    currency: string,
    baseCurrency: string,
  ) => Promise<ValuationFxRateResult>;
};

const accountRepository = createAccountRepository();
const holdingRepository = createHoldingRepository();
const liabilityRepository = createLiabilityRepository();
const priceRecordRepository = createPriceRecordRepository();

function toDecimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function toDecimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function buildFxRateMap(
  fxRates: Record<string, string | number> | undefined,
  baseCurrency: string,
) {
  const rateMap = new Map<string, Prisma.Decimal>([[baseCurrency, toDecimal(1)]]);

  for (const [currency, rawRate] of Object.entries(fxRates ?? {})) {
    const normalizedCurrency = normalizeCurrency(currency);

    if (!normalizedCurrency) {
      continue;
    }

    const trimmedRate =
      typeof rawRate === "string" ? rawRate.trim() : String(rawRate);

    if (!trimmedRate) {
      continue;
    }

    let decimalRate: Prisma.Decimal;

    try {
      decimalRate = toDecimal(trimmedRate);
    } catch {
      throw new RepositoryValidationError(
        `FX rate for ${normalizedCurrency} must be a valid number.`,
      );
    }

    if (decimalRate.lte(0)) {
      throw new RepositoryValidationError(
        `FX rate for ${normalizedCurrency} must be greater than zero.`,
      );
    }

    rateMap.set(normalizedCurrency, decimalRate);
  }

  return rateMap;
}

function createIssue(
  issues: ValuationPreviewIssue[],
  issue: ValuationPreviewIssue,
) {
  issues.push(issue);
}

function resolveFxRate(
  currency: string,
  rateMap: Map<string, Prisma.Decimal>,
) {
  return rateMap.get(normalizeCurrency(currency)) ?? null;
}

export async function createValuationPreviewForUser(
  userId: string,
  fxRates?: Record<string, string | number>,
) {
  const [accounts, holdings, liabilities, latestPriceRecords] = await Promise.all([
    accountRepository.listByUser(userId),
    holdingRepository.listByUser(userId),
    liabilityRepository.listByUser(userId),
    priceRecordRepository.listLatestByUser(userId),
  ]);

  return buildValuationPreview({
    accounts,
    holdings,
    liabilities,
    latestPriceRecords,
    fxRates,
  });
}

export async function createValuationContextForUser(userId: string) {
  const [accounts, holdings, liabilities, latestPriceRecords] = await Promise.all([
    accountRepository.listByUser(userId),
    holdingRepository.listByUser(userId),
    liabilityRepository.listByUser(userId),
    priceRecordRepository.listLatestByUser(userId),
  ]);

  return buildValuationContext({
    accounts,
    holdings,
    liabilities,
    latestPriceRecords,
  });
}

export async function buildValuationContext({
  accounts,
  holdings,
  liabilities,
  latestPriceRecords,
  baseCurrency = VALUATION_BASE_CURRENCY,
  fetchFxRate = fetchFxRateToBase,
}: BuildValuationContextInput): Promise<ValuationContext> {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const requiredCurrencies = collectRequiredFxCurrencies({
    accounts,
    holdings,
    liabilities,
    latestPriceRecords,
    baseCurrency: normalizedBaseCurrency,
  });
  const fxRateResults = await Promise.all(
    requiredCurrencies.map((currency) =>
      fetchFxRate(currency, normalizedBaseCurrency),
    ),
  );

  return {
    baseCurrency: normalizedBaseCurrency,
    requiredCurrencies,
    fxRateResults,
  };
}

export function collectRequiredFxCurrencies({
  accounts,
  holdings,
  liabilities,
  latestPriceRecords,
  baseCurrency = VALUATION_BASE_CURRENCY,
}: {
  accounts: Account[];
  holdings: HoldingWithRelations[];
  liabilities: LiabilityWithPaymentAccount[];
  latestPriceRecords: PriceRecordWithAsset[];
  baseCurrency?: string;
}) {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const activeAssetIds = new Set(
    holdings
      .filter(
        (holding) =>
          holding.isActive && holding.account.isActive && holding.asset.isActive,
      )
      .map((holding) => holding.assetId),
  );
  const latestValidPriceByAssetId = new Map<string, PriceRecordWithAsset>();

  for (const record of latestPriceRecords) {
    if (
      record.isValid &&
      activeAssetIds.has(record.assetId) &&
      !latestValidPriceByAssetId.has(record.assetId)
    ) {
      latestValidPriceByAssetId.set(record.assetId, record);
    }
  }

  return [...new Set([
    ...accounts
      .filter((account) => account.isActive)
      .map((account) => normalizeCurrency(account.currency)),
    ...liabilities
      .filter((liability) => liability.isActive)
      .map((liability) => normalizeCurrency(liability.currency)),
    ...[...latestValidPriceByAssetId.values()].map((record) =>
      normalizeCurrency(record.currency),
    ),
  ])]
    .filter((currency) => currency && currency !== normalizedBaseCurrency)
    .sort();
}

export function buildValuationPreview({
  accounts,
  holdings,
  liabilities,
  latestPriceRecords,
  fxRates,
  generatedAt = new Date(),
  baseCurrency = VALUATION_BASE_CURRENCY,
}: BuildValuationPreviewInput): ValuationPreviewResult {
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const activeHoldings = holdings.filter(
    (holding) =>
      holding.isActive && holding.account.isActive && holding.asset.isActive,
  );
  const activeLiabilities = liabilities.filter((liability) => liability.isActive);
  const issues: ValuationPreviewIssue[] = [];
  const rateMap = buildFxRateMap(fxRates, normalizedBaseCurrency);
  const latestPriceByAssetId = new Map<string, PriceRecordWithAsset>();

  for (const record of latestPriceRecords) {
    if (!latestPriceByAssetId.has(record.assetId) && record.isValid) {
      latestPriceByAssetId.set(record.assetId, record);
    }
  }

  let cashPosition = toDecimal(0);
  let investmentValue = toDecimal(0);
  let totalLiabilities = toDecimal(0);
  let monthlyDebtPaymentTotal = toDecimal(0);
  const holdingsByAccountId = new Map<string, Prisma.Decimal>();

  const previewHoldings = activeHoldings.map((holding) => {
    const latestPrice = latestPriceByAssetId.get(holding.assetId) ?? null;
    const fxRate = latestPrice
      ? resolveFxRate(latestPrice.currency, rateMap)
      : null;
    let marketValue = toDecimal(0);

    if (!latestPrice) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_PRICE,
        affectedEntityType: SnapshotEntityType.ASSET,
        affectedEntityId: holding.asset.id,
        message: `Missing valid price record for ${holding.asset.name}.`,
      });
    } else if (!fxRate) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_FX_RATE,
        affectedEntityType: SnapshotEntityType.HOLDING,
        affectedEntityId: holding.id,
        message: `Missing FX rate to ${normalizedBaseCurrency} for holding ${holding.asset.name} priced in ${normalizeCurrency(latestPrice.currency)}.`,
      });
    } else {
      marketValue = toDecimal(holding.quantity)
        .mul(latestPrice.price)
        .mul(fxRate);
      investmentValue = investmentValue.add(marketValue);
      holdingsByAccountId.set(
        holding.accountId,
        (holdingsByAccountId.get(holding.accountId) ?? toDecimal(0)).add(marketValue),
      );
    }

    return {
      sourceHoldingId: holding.id,
      sourceAccountId: holding.accountId,
      sourceAssetId: holding.assetId,
      accountName: holding.account.name,
      assetName: holding.asset.name,
      assetType: holding.asset.assetType,
      symbol: holding.asset.symbol,
      quantity: holding.quantity.toString(),
      assetCurrency: normalizeCurrency(holding.asset.currency),
      priceAmount: latestPrice ? latestPrice.price.toString() : null,
      priceCurrency: latestPrice ? normalizeCurrency(latestPrice.currency) : null,
      priceRecordedAt: latestPrice ? latestPrice.recordedAt.toISOString() : null,
      fxRateToBase: fxRate ? fxRate.toString() : null,
      marketValue: toDecimalString(marketValue),
    };
  });

  const previewAccounts = activeAccounts.map((account) => {
    const fxRate = resolveFxRate(account.currency, rateMap);
    let cashValue = toDecimal(0);

    if (!fxRate) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_FX_RATE,
        affectedEntityType: SnapshotEntityType.ACCOUNT,
        affectedEntityId: account.id,
        message: `Missing FX rate to ${normalizedBaseCurrency} for account ${account.name} in ${normalizeCurrency(account.currency)}.`,
      });
    } else {
      cashValue = toDecimal(account.cashBalance).mul(fxRate);
      cashPosition = cashPosition.add(cashValue);
    }

    const holdingsValue = holdingsByAccountId.get(account.id) ?? toDecimal(0);
    const totalValue = cashValue.add(holdingsValue);

    return {
      sourceAccountId: account.id,
      accountName: account.name,
      institutionName: account.institutionName,
      accountType: account.accountType,
      currency: normalizeCurrency(account.currency),
      cashBalance: account.cashBalance.toString(),
      cashValue: toDecimalString(cashValue),
      holdingsValue: toDecimalString(holdingsValue),
      totalValue: toDecimalString(totalValue),
    };
  });

  const previewLiabilities = activeLiabilities.map((liability) => {
    const fxRate = resolveFxRate(liability.currency, rateMap);
    let balanceValue = toDecimal(0);
    let monthlyPaymentValue = toDecimal(0);

    if (!fxRate) {
      createIssue(issues, {
        severity: SnapshotIssueSeverity.ERROR,
        issueType: SnapshotIssueType.MISSING_FX_RATE,
        affectedEntityType: SnapshotEntityType.LIABILITY,
        affectedEntityId: liability.id,
        message: `Missing FX rate to ${normalizedBaseCurrency} for liability ${liability.name} in ${normalizeCurrency(liability.currency)}.`,
      });
    } else {
      balanceValue = toDecimal(liability.currentBalance).mul(fxRate);
      monthlyPaymentValue = toDecimal(liability.monthlyPayment).mul(fxRate);
      totalLiabilities = totalLiabilities.add(balanceValue);
      monthlyDebtPaymentTotal = monthlyDebtPaymentTotal.add(monthlyPaymentValue);
    }

    return {
      sourceLiabilityId: liability.id,
      liabilityName: liability.name,
      liabilityType: liability.liabilityType,
      currency: normalizeCurrency(liability.currency),
      currentBalance: liability.currentBalance.toString(),
      monthlyPayment: liability.monthlyPayment.toString(),
      fxRateToBase: fxRate ? fxRate.toString() : null,
      balanceValue: toDecimalString(balanceValue),
      monthlyPaymentValue: toDecimalString(monthlyPaymentValue),
      paymentAccountName: liability.paymentAccount?.name ?? null,
    };
  });

  const totalAssets = cashPosition.add(investmentValue);
  const netWorth = totalAssets.sub(totalLiabilities);
  const status = issues.length > 0 ? SnapshotStatus.INCOMPLETE : SnapshotStatus.COMPLETE;
  const generatedAtIso = generatedAt.toISOString();

  return {
    status,
    baseCurrency: normalizedBaseCurrency,
    generatedAt: generatedAtIso,
    totalAssets: toDecimalString(totalAssets),
    totalLiabilities: toDecimalString(totalLiabilities),
    netWorth: toDecimalString(netWorth),
    cashPosition: toDecimalString(cashPosition),
    investmentValue: toDecimalString(investmentValue),
    monthlyDebtPaymentTotal: toDecimalString(monthlyDebtPaymentTotal),
    accounts: previewAccounts,
    holdings: previewHoldings,
    liabilities: previewLiabilities,
    issues,
    previewInput: {
      generatedAt: generatedAtIso,
      baseCurrency: normalizedBaseCurrency,
      fxRates: [...rateMap.entries()].map(([currency, rate]) => ({
        currency,
        rateToBase: rate.toString(),
      })),
      accounts: previewAccounts.map((account) => ({
        sourceAccountId: account.sourceAccountId,
        accountName: account.accountName,
        institutionName: account.institutionName,
        accountType: account.accountType,
        currency: account.currency,
        cashBalance: account.cashBalance,
      })),
      holdings: previewHoldings.map((holding) => ({
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
      liabilities: previewLiabilities.map((liability) => ({
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
