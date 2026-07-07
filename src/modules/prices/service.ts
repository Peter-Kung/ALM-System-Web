import {
  AssetPriceSourceType,
  PriceRecordSourceType,
  type Asset,
} from "@prisma/client";

import { createAssetRepository } from "@/modules/assets";
import { createPriceRecordRepository } from "@/modules/prices/repository";

type AutoRefreshSuccess = {
  assetId: string;
  assetName: string;
  symbol: string;
  priceRecordId: string;
  price: string;
  currency: string;
  recordedAt: string;
};

type AutoRefreshFailure = {
  assetId: string;
  assetName: string;
  symbol: string | null;
  reason: string;
};

type AutoRefreshResult = {
  refreshed: AutoRefreshSuccess[];
  failed: AutoRefreshFailure[];
};

type AutoRefreshItemResult = AutoRefreshSuccess | AutoRefreshFailure;

type YahooChartResponse = {
  chart?: {
    error?: { description?: string | null } | null;
    result?: Array<{
      meta?: {
        currency?: string | null;
        regularMarketPrice?: number | null;
        previousClose?: number | null;
        regularMarketTime?: number | null;
      } | null;
    }>;
  };
};

const autoPriceAssetRepository = createAssetRepository();
const autoPriceRecordRepository = createPriceRecordRepository();

export async function refreshAutoPriceRecordsForUser(
  userId: string,
): Promise<AutoRefreshResult> {
  const assets = await autoPriceAssetRepository.listByUser(userId);
  const autoAssets = assets.filter(
    (asset) => asset.isActive && asset.priceSourceType === AssetPriceSourceType.AUTO,
  );

  const results = await Promise.all(autoAssets.map((asset) => refreshAutoPriceForAsset(asset)));

  return results.reduce<AutoRefreshResult>(
    (summary, result) => {
      if ("reason" in result) {
        summary.failed.push(result);
      } else {
        summary.refreshed.push(result);
      }

      return summary;
    },
    { refreshed: [], failed: [] },
  );
}

async function refreshAutoPriceForAsset(
  asset: Asset,
): Promise<AutoRefreshItemResult> {
  if (!asset.symbol) {
    return {
      assetId: asset.id,
      assetName: asset.name,
      symbol: null,
      reason: "Auto-priced assets need a symbol before refresh can run.",
    };
  }

  try {
    const latestQuote = await fetchYahooQuote(asset.symbol);
    const priceRecord = await autoPriceRecordRepository.create(
      {
        assetId: asset.id,
        sourceType: PriceRecordSourceType.AUTO_REFRESH,
        currency: latestQuote.currency ?? asset.currency,
        price: latestQuote.price.toString(),
        recordedAt: latestQuote.recordedAt,
        isValid: true,
      },
      asset.userId,
    );

    return {
      assetId: asset.id,
      assetName: asset.name,
      symbol: asset.symbol,
      priceRecordId: priceRecord.id,
      price: priceRecord.price.toString(),
      currency: priceRecord.currency,
      recordedAt: priceRecord.recordedAt.toISOString(),
    };
  } catch (error) {
    return {
      assetId: asset.id,
      assetName: asset.name,
      symbol: asset.symbol,
      reason:
        error instanceof Error
          ? error.message
          : "Price refresh failed for an unknown reason.",
    };
  }
}

async function fetchYahooQuote(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status} for ${symbol}.`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const errorMessage = payload.chart?.error?.description;
  const price =
    result?.meta?.regularMarketPrice ?? result?.meta?.previousClose ?? null;

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error(`No valid market price was returned for ${symbol}.`);
  }

  const regularMarketTime = result?.meta?.regularMarketTime;

  return {
    currency: result?.meta?.currency ?? null,
    price,
    recordedAt:
      typeof regularMarketTime === "number"
        ? new Date(regularMarketTime * 1000)
        : new Date(),
  };
}
