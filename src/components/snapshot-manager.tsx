"use client";

import { useRef } from "react";
import { useEffect, useState } from "react";

import { formatReadOnlyMoney } from "@/lib/read-only-money-format";

type SnapshotSummary = {
  id: string;
  status: "COMPLETE" | "INCOMPLETE";
  baseCurrency: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  cashPosition: string;
  investmentValue: string;
  monthlyDebtPaymentTotal: string;
  snapshotAt: string;
  createdAt: string;
  accountCount: number;
  holdingCount: number;
  liabilityCount: number;
  issueCount: number;
};

type SnapshotDetail = {
  id: string;
  status: "COMPLETE" | "INCOMPLETE";
  baseCurrency: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  cashPosition: string;
  investmentValue: string;
  monthlyDebtPaymentTotal: string;
  snapshotAt: string;
  accounts: Array<{
    id: string;
    accountName: string;
    institutionName: string;
    accountType: string;
    currency: string;
    cashBalance: string;
    holdingsValue: string;
    totalValue: string;
  }>;
  holdings: Array<{
    id: string;
    accountName: string;
    assetName: string;
    assetType: string;
    symbol: string | null;
    quantity: string;
    assetCurrency: string;
    priceAmount: string | null;
    priceCurrency: string | null;
    priceRecordedAt: string | null;
    fxRateToBase: string | null;
    marketValue: string;
  }>;
  liabilities: Array<{
    id: string;
    liabilityName: string;
    liabilityType: string;
    currency: string;
    currentBalance: string;
    monthlyPayment: string;
    fxRateToBase: string | null;
    balanceValue: string;
    monthlyPaymentValue: string;
    paymentAccountName: string | null;
  }>;
  issues: Array<{
    id: string;
    severity: string;
    issueType: string;
    message: string;
  }>;
};

export function SnapshotManager() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailRequestId = useRef(0);

  useEffect(() => {
    void loadSnapshots();
  }, []);

  async function loadSnapshots() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/snapshots");
      const payload = (await response.json()) as {
        snapshots?: SnapshotSummary[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load snapshots.");
      }

      const nextSnapshots = payload.snapshots ?? [];
      setSnapshots(nextSnapshots);

      if (nextSnapshots[0]) {
        void loadSnapshotDetail(nextSnapshots[0].id);
      } else {
        setSelectedSnapshotId(null);
        setSelectedSnapshot(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load snapshots.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSnapshotDetail(snapshotId: string) {
    const requestId = ++detailRequestId.current;
    setSelectedSnapshotId(snapshotId);
    setSelectedSnapshot(null);
    setIsDetailLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/snapshots/${snapshotId}`);
      const payload = (await response.json()) as {
        snapshot?: SnapshotDetail;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load snapshot detail.");
      }

      if (requestId !== detailRequestId.current) {
        return;
      }

      setSelectedSnapshot(payload.snapshot ?? null);
    } catch (loadError) {
      if (requestId !== detailRequestId.current) {
        return;
      }

      setSelectedSnapshot(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load snapshot detail.",
      );
    } finally {
      if (requestId === detailRequestId.current) {
        setIsDetailLoading(false);
      }
    }
  }

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Snapshot history</p>
        <h1>Snapshots</h1>
        <p className="muted">
          Review immutable valuation snapshots and inspect the stored account,
          holding, liability, and issue detail for each saved run.
        </p>
      </div>
      <div className="management-grid">
        <div className="card stack">
          <div className="section-heading">
            <div>
              <h2>Saved snapshots</h2>
              <p className="muted">
                {snapshots.length === 0
                  ? "No snapshot history yet."
                  : `${snapshots.length} saved snapshots`}
              </p>
            </div>
          </div>
          {isLoading ? <div className="placeholder">Loading snapshots...</div> : null}
          {!isLoading && snapshots.length === 0 ? (
            <div className="placeholder">
              Run a valuation preview and confirm it to create the first snapshot.
            </div>
          ) : null}
          {snapshots.map((snapshot) => (
            <button
              key={snapshot.id}
              type="button"
              className="resource-card stack"
              onClick={() => void loadSnapshotDetail(snapshot.id)}
              disabled={selectedSnapshotId === snapshot.id && isDetailLoading}
            >
              <div className="section-heading">
                <div>
                  <h3>{formatDateTime(snapshot.snapshotAt)}</h3>
                  <p className="muted">
                    Status: {snapshot.status} · {snapshot.issueCount} issues
                  </p>
                </div>
                <strong>
                  {formatReadOnlyMoney(snapshot.netWorth, { currency: snapshot.baseCurrency })}
                </strong>
              </div>
              <p className="muted">
                Assets {formatReadOnlyMoney(snapshot.totalAssets)} · Liabilities{" "}
                {formatReadOnlyMoney(snapshot.totalLiabilities)} ·{" "}
                {snapshot.accountCount} accounts · {snapshot.holdingCount} holdings ·{" "}
                {snapshot.liabilityCount} liabilities
              </p>
            </button>
          ))}
        </div>
        <div className="stack">
          <div className="section-heading">
            <h2>Snapshot detail</h2>
            <p className="muted">
              {selectedSnapshot
                ? `Saved ${formatDateTime(selectedSnapshot.snapshotAt)}`
                : "Select a saved snapshot to inspect immutable detail."}
            </p>
          </div>
          {isDetailLoading ? <div className="placeholder">Loading snapshot detail...</div> : null}
          {!isDetailLoading && !selectedSnapshot ? (
            <div className="placeholder">No snapshot selected yet.</div>
          ) : null}
          {selectedSnapshot ? (
            <>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Summary</h3>
                    <p className="muted">Status: {selectedSnapshot.status}</p>
                  </div>
                  <strong>
                    {formatReadOnlyMoney(selectedSnapshot.netWorth, {
                      currency: selectedSnapshot.baseCurrency,
                    })}
                  </strong>
                </div>
                <dl className="detail-grid">
                  <div>
                    <dt>Total assets</dt>
                    <dd>
                      {formatReadOnlyMoney(selectedSnapshot.totalAssets, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Total liabilities</dt>
                    <dd>
                      {formatReadOnlyMoney(selectedSnapshot.totalLiabilities, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Cash position</dt>
                    <dd>
                      {formatReadOnlyMoney(selectedSnapshot.cashPosition, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Investment value</dt>
                    <dd>
                      {formatReadOnlyMoney(selectedSnapshot.investmentValue, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Monthly debt payments</dt>
                    <dd>
                      {formatReadOnlyMoney(selectedSnapshot.monthlyDebtPaymentTotal, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </dd>
                  </div>
                </dl>
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Issues</h3>
                    <p className="muted">
                      {selectedSnapshot.issues.length === 0
                        ? "No issues recorded for this snapshot."
                        : `${selectedSnapshot.issues.length} recorded issues`}
                    </p>
                  </div>
                </div>
                {selectedSnapshot.issues.length === 0 ? (
                  <p className="muted">This snapshot completed without missing inputs.</p>
                ) : (
                  selectedSnapshot.issues.map((issue) => (
                    <div key={issue.id}>
                      <strong>
                        {formatEnumLabel(issue.severity)} · {formatEnumLabel(issue.issueType)}
                      </strong>
                      <p className="muted">{issue.message}</p>
                    </div>
                  ))
                )}
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Accounts</h3>
                    <p className="muted">{selectedSnapshot.accounts.length} stored accounts</p>
                  </div>
                </div>
                {selectedSnapshot.accounts.map((account) => (
                  <div key={account.id}>
                    <strong>{account.accountName}</strong>
                    <p className="muted">
                      {formatEnumLabel(account.accountType)} · Cash{" "}
                      {formatReadOnlyMoney(account.cashBalance, {
                        currency: account.currency,
                      })}{" "}
                      · Total{" "}
                      {formatReadOnlyMoney(account.totalValue, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </p>
                  </div>
                ))}
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Holdings</h3>
                    <p className="muted">{selectedSnapshot.holdings.length} stored holdings</p>
                  </div>
                </div>
                {selectedSnapshot.holdings.map((holding) => (
                  <div key={holding.id}>
                    <strong>{holding.assetName}</strong>
                    <p className="muted">
                      {holding.quantity} units ·{" "}
                      {holding.priceAmount && holding.priceCurrency
                        ? formatReadOnlyMoney(holding.priceAmount, {
                            currency: holding.priceCurrency,
                          })
                        : "Missing price"}{" "}
                      · FX {holding.fxRateToBase ?? "missing"} · Value{" "}
                      {formatReadOnlyMoney(holding.marketValue, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </p>
                  </div>
                ))}
              </article>
              <article className="resource-card stack">
                <div className="section-heading">
                  <div>
                    <h3>Liabilities</h3>
                    <p className="muted">
                      {selectedSnapshot.liabilities.length} stored liabilities
                    </p>
                  </div>
                </div>
                {selectedSnapshot.liabilities.map((liability) => (
                  <div key={liability.id}>
                    <strong>{liability.liabilityName}</strong>
                    <p className="muted">
                      Balance{" "}
                      {formatReadOnlyMoney(liability.currentBalance, {
                        currency: liability.currency,
                      })}{" "}
                      · FX {liability.fxRateToBase ?? "missing"} · Value{" "}
                      {formatReadOnlyMoney(liability.balanceValue, {
                        currency: selectedSnapshot.baseCurrency,
                      })}
                    </p>
                  </div>
                ))}
              </article>
            </>
          ) : null}
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
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
