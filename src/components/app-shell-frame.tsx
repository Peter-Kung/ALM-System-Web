import Link from "next/link";
import React from "react";
import { ReactNode } from "react";
import type { Route } from "next";

import { footerNavigation, primaryNavigation } from "@/lib/navigation";

export type WorkspaceSummary = {
  latestSnapshotLabel: string;
  netWorthLabel: string;
  snapshotStatusLabel: string;
  metricRows: Array<{
    label: string;
    value: string;
  }>;
  reminderLabel: string;
};

type AppShellFrameProps = {
  children: ReactNode;
  pathname: string;
  username: string;
  summary: WorkspaceSummary;
};

export function AppShellFrame({
  children,
  pathname,
  username,
  summary,
}: AppShellFrameProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand stack">
          <div className="brand-mark" aria-hidden="true">
            ALM
          </div>
          <div className="sidebar-header">
            <p className="eyebrow">Private finance workspace</p>
            <h1>ALM System</h1>
            <p className="muted">Signed in as {username}</p>
          </div>
        </div>

        <section className="sidebar-summary stack" aria-label="Workspace financial summary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Snapshot pulse</p>
              <h2>{summary.netWorthLabel}</h2>
            </div>
            <span className="summary-chip">{summary.snapshotStatusLabel}</span>
          </div>
          <p className="summary-meta">{summary.latestSnapshotLabel}</p>
          <dl className="summary-metrics">
            {summary.metricRows.map((metric) => (
              <div key={metric.label} className="summary-metric-row">
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">{summary.reminderLabel}</p>
        </section>

        <nav className="sidebar-nav stack" aria-label="Primary">
          {primaryNavigation.map((group) => (
            <div key={group.heading} className="nav-group stack">
              <p className="nav-group-title">{group.heading}</p>
              <div className="stack nav-group-links">
                {group.items.map((section) => {
                  const isActive =
                    pathname === section.href || pathname.startsWith(`${section.href}/`);

                  return (
                    <Link
                      key={section.href}
                      href={section.href as Route}
                      className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                    >
                      <span className="nav-link-index">{section.shortLabel}</span>
                      <span>{section.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer stack">
          {footerNavigation.map((section) => {
            const isActive =
              pathname === section.href || pathname.startsWith(`${section.href}/`);

            return (
              <Link
                key={section.href}
                href={section.href as Route}
                className={`nav-link nav-link-footer ${isActive ? "nav-link-active" : ""}`}
              >
                <span className="nav-link-index">{section.shortLabel}</span>
                <span>{section.label}</span>
              </Link>
            );
          })}
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="ghost-button">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="main-panel">
        <div className="main-panel-inner">{children}</div>
      </main>
    </div>
  );
}
