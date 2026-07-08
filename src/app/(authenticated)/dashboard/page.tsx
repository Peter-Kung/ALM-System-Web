import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionFromCookies } from "@/lib/auth/session";
import { createDashboardSummaryForUser } from "@/modules/dashboard";

export default async function DashboardPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const dashboard = await createDashboardSummaryForUser(session.sub);

  if (!dashboard.latestSnapshot) {
    return (
      <section className="stack">
        <div className="hero stack">
          <p className="eyebrow">Latest snapshot dashboard</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Save the first valuation snapshot to unlock the latest financial summary,
            allocation view, debt pressure, and trend reporting.
          </p>
        </div>
        <article className="placeholder stack">
          <h2>No saved snapshot yet</h2>
          <p className="muted">
            Run a valuation preview and confirm it to create the first immutable
            snapshot for dashboard reporting.
          </p>
          <div>
            <Link href="/manage/valuation" className="nav-link dashboard-link">
              Open valuation workspace
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const snapshot = dashboard.latestSnapshot;

  return (
    <section className="stack">
      <div className="hero stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Latest snapshot dashboard</p>
            <h1>Dashboard</h1>
            <p className="muted">
              Reporting from the latest saved snapshot taken on{" "}
              {formatDateTime(snapshot.snapshotAt)}.
            </p>
          </div>
          <span
            className={`status-pill ${
              snapshot.status === "COMPLETE" ? "status-complete" : "status-incomplete"
            }`}
          >
            {snapshot.status === "COMPLETE" ? "Snapshot complete" : "Snapshot incomplete"}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="resource-card stack dashboard-highlight">
          <p className="eyebrow">Net worth</p>
          <h2>
            {snapshot.netWorth} {snapshot.baseCurrency}
          </h2>
          <p className="muted">
            Assets {snapshot.totalAssets} {snapshot.baseCurrency} · Liabilities{" "}
            {snapshot.totalLiabilities} {snapshot.baseCurrency}
          </p>
        </article>
        <article className="resource-card stack">
          <p className="eyebrow">Cash position</p>
          <h2>
            {snapshot.cashPosition} {snapshot.baseCurrency}
          </h2>
          <p className="muted">Saved cash balances from the latest formal snapshot.</p>
        </article>
        <article className="resource-card stack">
          <p className="eyebrow">Investment value</p>
          <h2>
            {snapshot.investmentValue} {snapshot.baseCurrency}
          </h2>
          <p className="muted">Derived from the stored holding valuations in the snapshot.</p>
        </article>
        <article className="resource-card stack">
          <p className="eyebrow">Debt pressure</p>
          <h2>
            {snapshot.monthlyDebtPaymentTotal} {snapshot.baseCurrency}
          </h2>
          <p className="muted">
            Monthly debt payments across {snapshot.liabilityCount} saved liabilities.
          </p>
        </article>
      </div>

      <div className="dashboard-grid dashboard-grid-secondary">
        <article className="resource-card stack">
          <div className="section-heading">
            <div>
              <h2>Allocation</h2>
              <p className="muted">
                Cash and investment mix from the latest saved snapshot.
              </p>
            </div>
          </div>
          {dashboard.allocation.length === 0 ? (
            <p className="muted">No asset allocation data is stored yet.</p>
          ) : (
            <div className="stack">
              {dashboard.allocation.map((item) => (
                <div key={item.label} className="metric-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p className="muted">{item.shareOfAssets}% of total assets</p>
                  </div>
                  <strong>
                    {item.value} {snapshot.baseCurrency}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="resource-card stack">
          <div className="section-heading">
            <div>
              <h2>Debt balances</h2>
              <p className="muted">Latest liability breakdown from immutable snapshot data.</p>
            </div>
          </div>
          {dashboard.liabilityBreakdown.length === 0 ? (
            <p className="muted">No liabilities are stored in the latest snapshot.</p>
          ) : (
            <div className="stack">
              {dashboard.liabilityBreakdown.map((item) => (
                <div key={item.label} className="metric-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p className="muted">{item.shareOfAssets}% of total liabilities</p>
                  </div>
                  <strong>
                    {item.value} {snapshot.baseCurrency}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="resource-card stack">
          <div className="section-heading">
            <div>
              <h2>Trend summary</h2>
              <p className="muted">
                {dashboard.trend
                  ? `Compared with the snapshot from ${formatDateTime(
                      dashboard.trend.previousSnapshotAt,
                    )}.`
                  : "Create one more snapshot to unlock comparison trends."}
              </p>
            </div>
          </div>
          {dashboard.trend ? (
            <dl className="detail-grid">
              <div>
                <dt>Net worth change</dt>
                <dd>{formatSignedAmount(dashboard.trend.netWorthChange, snapshot.baseCurrency)}</dd>
              </div>
              <div>
                <dt>Asset change</dt>
                <dd>
                  {formatSignedAmount(dashboard.trend.totalAssetsChange, snapshot.baseCurrency)}
                </dd>
              </div>
              <div>
                <dt>Liability change</dt>
                <dd>
                  {formatSignedAmount(
                    dashboard.trend.totalLiabilitiesChange,
                    snapshot.baseCurrency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Monthly debt change</dt>
                <dd>
                  {formatSignedAmount(
                    dashboard.trend.monthlyDebtPaymentChange,
                    snapshot.baseCurrency,
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted">The latest snapshot has no earlier snapshot to compare against.</p>
          )}
        </article>
      </div>

      <div className="dashboard-grid dashboard-grid-secondary">
        <article className="resource-card stack">
          <div className="section-heading">
            <div>
              <h2>Snapshot health</h2>
              <p className="muted">
                {snapshot.issueCount === 0
                  ? "No stored issues in the latest snapshot."
                  : `${snapshot.issueCount} stored issues in the latest snapshot.`}
              </p>
            </div>
            <Link href="/manage/snapshots" className="nav-link dashboard-link">
              Review history
            </Link>
          </div>
          {dashboard.issueMessages.length === 0 ? (
            <p className="muted">The latest snapshot completed without missing-input warnings.</p>
          ) : (
            <div className="stack">
              {dashboard.issueMessages.map((message) => (
                <div key={message} className="issue-note">
                  {message}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="resource-card stack">
          <div className="section-heading">
            <div>
              <h2>Coverage</h2>
              <p className="muted">Saved records represented in the latest dashboard source.</p>
            </div>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Accounts</dt>
              <dd>{snapshot.accountCount}</dd>
            </div>
            <div>
              <dt>Holdings</dt>
              <dd>{snapshot.holdingCount}</dd>
            </div>
            <div>
              <dt>Liabilities</dt>
              <dd>{snapshot.liabilityCount}</dd>
            </div>
            <div>
              <dt>Snapshot time</dt>
              <dd>{formatShortDateTime(snapshot.snapshotAt)}</dd>
            </div>
          </dl>
        </article>
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

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatSignedAmount(value: string, currency: string) {
  const numeric = Number(value);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${value} ${currency}`;
}
