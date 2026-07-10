import Link from "next/link";
import React from "react";

import { DashboardAllocationCard } from "@/components/dashboard-allocation-card";
import { DashboardTrendCard } from "@/components/dashboard-trend-card";
import type { DashboardRoute, DashboardSummary } from "@/modules/dashboard/service";

type DashboardPageViewProps = {
  dashboard: DashboardSummary;
};

export function DashboardPageView({ dashboard }: DashboardPageViewProps) {
  if (!dashboard.latestSnapshot) {
    const emptyState = dashboard.emptyState;

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
            <DashboardLink href={emptyState?.actionHref ?? "/manage/valuation"}>
              Open valuation workspace
            </DashboardLink>
          </div>
        </article>
      </section>
    );
  }

  const snapshot = dashboard.latestSnapshot;
  const heroSummary = dashboard.heroSummary;
  const coverage = dashboard.coverage;
  const reminders = dashboard.reminders;
  const reminderSummary =
    reminders.issueCount === 0
      ? "No reminder items recorded in the latest snapshot."
      : `${reminders.issueCount} reminder item${reminders.issueCount === 1 ? "" : "s"} recorded in the latest snapshot.`;

  return (
    <section className="stack">
      <div className="dashboard-hero">
        <div className="hero stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest snapshot dashboard</p>
              <h1>Dashboard</h1>
            </div>
            <span
              className={`status-pill ${
                snapshot.status === "COMPLETE" ? "status-complete" : "status-incomplete"
              }`}
            >
              {snapshot.status === "COMPLETE" ? "Snapshot complete" : "Snapshot incomplete"}
            </span>
          </div>
          <p className="dashboard-summary-message">{buildHeroMessage(heroSummary)}</p>
          <p className="muted">
            Reporting from the latest saved snapshot taken on{" "}
            {formatDateTime(heroSummary?.snapshotAt ?? snapshot.snapshotAt)}.
          </p>
          <p className="muted">{reminderSummary}</p>
        </div>

        <article className="resource-card stack dashboard-freshness">
          <p className="eyebrow">Freshness</p>
          <h2>{formatShortDateTime(snapshot.snapshotAt)}</h2>
          <p className="muted">
            {coverage?.accountCount ?? snapshot.accountCount} accounts,{" "}
            {coverage?.holdingCount ?? snapshot.holdingCount} holdings, and{" "}
            {coverage?.liabilityCount ?? snapshot.liabilityCount} liabilities represented in
            the current summary.
          </p>
        </article>
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
          <p className="eyebrow">Total assets</p>
          <h2>
            {snapshot.totalAssets} {snapshot.baseCurrency}
          </h2>
          <p className="muted">Stored account cash plus saved holding values.</p>
        </article>
        <article className="resource-card stack">
          <p className="eyebrow">Total liabilities</p>
          <h2>
            {snapshot.totalLiabilities} {snapshot.baseCurrency}
          </h2>
          <p className="muted">Saved debt balances carried by the latest snapshot.</p>
        </article>
        <article className="resource-card stack">
          <p className="eyebrow">Cash position</p>
          <h2>
            {snapshot.cashPosition} {snapshot.baseCurrency}
          </h2>
          <p className="muted">Saved cash balances from the latest formal snapshot.</p>
        </article>
      </div>

      <article className="resource-card stack dashboard-reminders">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Next up</p>
            <h2>Reminders</h2>
            <p className="muted">
              {reminders.issueCount === 0
                ? "No active reminders in the latest snapshot."
                : `${reminders.issueCount} stored issues in the latest snapshot.`}
            </p>
          </div>
          <DashboardLink href="/manage/snapshots">Review history</DashboardLink>
        </div>
        {reminders.visibleMessages.length === 0 ? (
          <p className="muted">The latest snapshot completed without missing-input warnings.</p>
        ) : (
          <div className="stack">
            {reminders.visibleMessages.map((message) => (
              <div key={message} className="issue-note">
                {message}
              </div>
            ))}
            {reminders.remainingCount > 0 ? (
              <p className="muted">
                {reminders.remainingCount} more reminder
                {reminders.remainingCount === 1 ? "" : "s"} recorded in the latest snapshot.
              </p>
            ) : null}
          </div>
        )}
      </article>

      <DashboardAllocationCard
        allocation={dashboard.allocation}
        baseCurrency={snapshot.baseCurrency}
      />

      <DashboardTrendCard
        trendSeries={dashboard.trendSeries}
        baseCurrency={snapshot.baseCurrency}
      />

      <div className="dashboard-grid dashboard-grid-secondary">
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
              <dd>{coverage?.accountCount ?? snapshot.accountCount}</dd>
            </div>
            <div>
              <dt>Holdings</dt>
              <dd>{coverage?.holdingCount ?? snapshot.holdingCount}</dd>
            </div>
            <div>
              <dt>Liabilities</dt>
              <dd>{coverage?.liabilityCount ?? snapshot.liabilityCount}</dd>
            </div>
            <div>
              <dt>Snapshot time</dt>
              <dd>{formatShortDateTime(coverage?.snapshotAt ?? snapshot.snapshotAt)}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function DashboardLink({ href, children }: { href: DashboardRoute; children: string }) {
  return (
    <Link href={href} className="nav-link dashboard-link">
      {children}
    </Link>
  );
}

function buildHeroMessage(
  heroSummary: DashboardSummary["heroSummary"],
) {
  if (!heroSummary) {
    return "The latest snapshot is current and ready for a deeper balance-sheet review.";
  }

  if (heroSummary.status === "INCOMPLETE") {
    return heroSummary.issueCount > 0
      ? "The latest snapshot is incomplete and needs reminder follow-up before reuse."
      : "The latest snapshot is incomplete and should be reviewed before reuse.";
  }

  if (heroSummary.netWorthDirection === "negative") {
    return "The latest snapshot shows liabilities outweighing assets and needs attention.";
  }

  if (heroSummary.issueCount > 0) {
    return "The latest snapshot is usable, but reminder items still need follow-up.";
  }

  if (heroSummary.hasTrend) {
    return "The latest snapshot is current and ready for side-by-side trend review.";
  }

  return "The latest snapshot is complete and ready for a deeper balance-sheet review.";
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
