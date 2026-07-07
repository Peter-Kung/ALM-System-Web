"use client";

import { FormEvent, useEffect, useState } from "react";

import type {
  ValuationPreviewResult,
} from "@/modules/valuation/types";
import { VALUATION_BASE_CURRENCY } from "@/modules/valuation/types";

export function ValuationManager() {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [fxRates, setFxRates] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ValuationPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadContext();
  }, []);

  async function loadContext() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/valuation/preview");
      const payload = (await response.json()) as {
        baseCurrency?: string;
        requiredCurrencies?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load valuation inputs.");
      }

      const nextCurrencies = payload.requiredCurrencies ?? [];

      setCurrencies(nextCurrencies);
      setFxRates((currentRates) =>
        nextCurrencies.reduce<Record<string, string>>((nextRates, currency) => {
          nextRates[currency] = currentRates[currency] ?? "";
          return nextRates;
        }, {}),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load valuation inputs.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPreviewing(true);
    setError(null);

    try {
      const response = await fetch("/api/valuation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fxRates: Object.fromEntries(
            Object.entries(fxRates)
              .map(([currency, value]) => [currency, value.trim()] as const)
              .filter(([, value]) => value.length > 0),
          ),
        }),
      });

      const payload = (await response.json()) as ValuationPreviewResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to run valuation preview.");
      }

      setPreview(payload);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Failed to run valuation preview.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Valuation preview</p>
        <h1>Valuation</h1>
        <p className="muted">
          Preview the next snapshot from current master data, latest prices, and
          operator-supplied FX rates before any history is saved.
        </p>
      </div>
      <div className="management-grid">
        <form className="card stack" onSubmit={handlePreview}>
          <div className="section-heading">
            <div>
              <h2>Preview inputs</h2>
              <p className="muted">
                Base currency is fixed to {VALUATION_BASE_CURRENCY}. Enter rates only
                for non-{VALUATION_BASE_CURRENCY} currencies in active data or valid
                price records.
              </p>
            </div>
          </div>
          {isLoading ? <div className="placeholder">Loading valuation inputs...</div> : null}
          {!isLoading && currencies.length === 0 ? (
            <div className="placeholder">
              No non-{VALUATION_BASE_CURRENCY} currencies are required right now.
              You can still run a preview.
            </div>
          ) : null}
          {!isLoading
            ? currencies.map((currency) => (
                <label key={currency} className="field">
                  <span>{currency} to {VALUATION_BASE_CURRENCY}</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={fxRates[currency] ?? ""}
                    onChange={(event) =>
                      setFxRates((currentRates) => ({
                        ...currentRates,
                        [currency]: event.target.value,
                      }))
                    }
                    placeholder={`1 ${currency} = ? ${VALUATION_BASE_CURRENCY}`}
                  />
                </label>
              ))
            : null}
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isLoading || isPreviewing}>
            {isPreviewing ? "Running preview..." : "Run valuation preview"}
          </button>
        </form>
        <div className="stack">
          <div className="section-heading">
            <h2>Preview result</h2>
            <p className="muted">
              {preview
                ? `Generated ${formatDateTime(preview.generatedAt)}`
                : "Run the preview to inspect totals and missing inputs."}
            </p>
          </div>
          {!preview ? (
            <div className="placeholder">
              No preview yet. Submit the preview form to inspect current valuation
              totals and issues.
            </div>
          ) : (
            <>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Summary</h3>
                    <p className="muted">Status: {preview.status}</p>
                  </div>
                  <strong>{preview.netWorth} {preview.baseCurrency}</strong>
                </div>
                <dl className="detail-grid">
                  <div>
                    <dt>Total assets</dt>
                    <dd>{preview.totalAssets} {preview.baseCurrency}</dd>
                  </div>
                  <div>
                    <dt>Total liabilities</dt>
                    <dd>{preview.totalLiabilities} {preview.baseCurrency}</dd>
                  </div>
                  <div>
                    <dt>Cash position</dt>
                    <dd>{preview.cashPosition} {preview.baseCurrency}</dd>
                  </div>
                  <div>
                    <dt>Investment value</dt>
                    <dd>{preview.investmentValue} {preview.baseCurrency}</dd>
                  </div>
                  <div>
                    <dt>Monthly debt payments</dt>
                    <dd>{preview.monthlyDebtPaymentTotal} {preview.baseCurrency}</dd>
                  </div>
                  <div>
                    <dt>Preview payload</dt>
                    <dd>
                      {preview.previewInput.accounts.length} accounts ·{" "}
                      {preview.previewInput.holdings.length} holdings ·{" "}
                      {preview.previewInput.liabilities.length} liabilities
                    </dd>
                  </div>
                </dl>
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Issues</h3>
                    <p className="muted">
                      {preview.issues.length === 0
                        ? "All required price and FX inputs were available."
                        : `${preview.issues.length} issues recorded in the preview.`}
                    </p>
                  </div>
                </div>
                {preview.issues.length === 0 ? (
                  <p className="muted">No issues detected.</p>
                ) : (
                  preview.issues.map((issue, index) => (
                    <div key={`${issue.issueType}-${issue.affectedEntityId ?? index}`}>
                      <strong>{formatEnumLabel(issue.issueType)}</strong>
                      <p className="muted">{issue.message}</p>
                    </div>
                  ))
                )}
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Accounts</h3>
                    <p className="muted">{preview.accounts.length} active accounts</p>
                  </div>
                </div>
                {preview.accounts.map((account) => (
                  <div key={account.sourceAccountId}>
                    <strong>{account.accountName}</strong>
                    <p className="muted">
                      Cash {account.cashValue} · Holdings {account.holdingsValue} · Total{" "}
                      {account.totalValue} {preview.baseCurrency}
                    </p>
                  </div>
                ))}
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Holdings</h3>
                    <p className="muted">{preview.holdings.length} active holdings</p>
                  </div>
                </div>
                {preview.holdings.length === 0 ? (
                  <p className="muted">No active holdings in the current preview.</p>
                ) : (
                  preview.holdings.map((holding) => (
                    <div key={holding.sourceHoldingId}>
                      <strong>{holding.assetName}</strong>
                      <p className="muted">
                        {holding.quantity} units ·{" "}
                        {holding.priceAmount
                          ? `${holding.priceAmount} ${holding.priceCurrency}`
                          : "No latest price"}{" "}
                        · Value {holding.marketValue} {preview.baseCurrency}
                      </p>
                    </div>
                  ))
                )}
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Liabilities</h3>
                    <p className="muted">{preview.liabilities.length} active liabilities</p>
                  </div>
                </div>
                {preview.liabilities.length === 0 ? (
                  <p className="muted">No active liabilities in the current preview.</p>
                ) : (
                  preview.liabilities.map((liability) => (
                    <div key={liability.sourceLiabilityId}>
                      <strong>{liability.liabilityName}</strong>
                      <p className="muted">
                        Balance {liability.balanceValue} · Monthly payment{" "}
                        {liability.monthlyPaymentValue} {preview.baseCurrency}
                      </p>
                    </div>
                  ))
                )}
              </article>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
