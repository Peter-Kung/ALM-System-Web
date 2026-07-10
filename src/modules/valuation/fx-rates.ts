import type { ValuationFxRateResult } from "@/modules/valuation/types";

type FxFetchOptions = {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

type YahooFxResponse = {
  chart?: {
    error?: { description?: string | null } | null;
    result?: Array<{
      meta?: {
        regularMarketPrice?: number | null;
        previousClose?: number | null;
        regularMarketTime?: number | null;
      } | null;
    }>;
  };
};

const YAHOO_FINANCE_PROVIDER = "Yahoo Finance";
const DEFAULT_FX_FETCH_TIMEOUT_MS = 5000;
const SUPPORTED_YAHOO_SYMBOLS = new Map<string, string>([
  ["USD:TWD", "USDTWD=X"],
]);

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function unsupportedResult(currency: string, baseCurrency: string): ValuationFxRateResult {
  return {
    currency,
    baseCurrency,
    status: "UNSUPPORTED",
    rateToBase: null,
    provider: null,
    fetchedAt: null,
    error: `No live rate source is configured for ${currency} to ${baseCurrency}.`,
  };
}

function failedResult(
  currency: string,
  baseCurrency: string,
  error: unknown,
): ValuationFxRateResult {
  return {
    currency,
    baseCurrency,
    status: "FAILED",
    rateToBase: null,
    provider: YAHOO_FINANCE_PROVIDER,
    fetchedAt: null,
    error:
      error instanceof Error
        ? error.message
        : `Failed to fetch ${currency} to ${baseCurrency}.`,
  };
}

export async function fetchFxRateToBase(
  currency: string,
  baseCurrency: string,
  {
    fetchFn = fetch,
    timeoutMs = DEFAULT_FX_FETCH_TIMEOUT_MS,
  }: FxFetchOptions = {},
): Promise<ValuationFxRateResult> {
  const normalizedCurrency = normalizeCurrency(currency);
  const normalizedBaseCurrency = normalizeCurrency(baseCurrency);
  const symbol = SUPPORTED_YAHOO_SYMBOLS.get(
    `${normalizedCurrency}:${normalizedBaseCurrency}`,
  );

  if (!symbol) {
    return unsupportedResult(normalizedCurrency, normalizedBaseCurrency);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort(
      new Error(
        `${YAHOO_FINANCE_PROVIDER} timed out fetching ${normalizedCurrency} to ${normalizedBaseCurrency}.`,
      ),
    );
  }, timeoutMs);

  try {
    const response = await fetchFn(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: abortController.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `${YAHOO_FINANCE_PROVIDER} returned ${response.status} for ${normalizedCurrency} to ${normalizedBaseCurrency}.`,
      );
    }

    const payload = (await response.json()) as YahooFxResponse;
    const result = payload.chart?.result?.[0];
    const errorMessage = payload.chart?.error?.description;
    const rate =
      result?.meta?.regularMarketPrice ?? result?.meta?.previousClose ?? null;

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `No valid FX rate was returned for ${normalizedCurrency} to ${normalizedBaseCurrency}.`,
      );
    }

    const regularMarketTime = result?.meta?.regularMarketTime;

    return {
      currency: normalizedCurrency,
      baseCurrency: normalizedBaseCurrency,
      status: "FETCHED",
      rateToBase: String(rate),
      provider: YAHOO_FINANCE_PROVIDER,
      fetchedAt:
        typeof regularMarketTime === "number"
          ? new Date(regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    return failedResult(normalizedCurrency, normalizedBaseCurrency, error);
  } finally {
    clearTimeout(timeout);
  }
}
