import React, { ReactNode } from "react";

export function LoginPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="login-layout">
      <section className="login-panel stack" aria-label="Owner sign in panel">
        {children}
      </section>

      <section className="login-hero stack">
        <div className="login-brand stack">
          <div className="brand-mark login-brand-mark" aria-hidden="true">
            ALM
          </div>
          <div className="stack">
            <p className="eyebrow">Private balance sheet workspace</p>
            <h2>Track the shape of your money with a calmer daily cockpit.</h2>
            <p className="muted">
              Review the latest snapshot, maintain core records, and move through
              valuation work from one cohesive desktop-first home base.
            </p>
          </div>
        </div>

        <div className="login-highlight-grid">
          <article className="resource-card stack login-highlight-card">
            <p className="eyebrow">Snapshot pulse</p>
            <h2>Summary first</h2>
            <p className="muted">
              Start the day with net worth context, freshness signals, and a short
              reminder list before deeper maintenance work.
            </p>
          </article>
          <article className="resource-card stack login-highlight-card">
            <p className="eyebrow">Workspace rhythm</p>
            <h2>Records stay close</h2>
            <p className="muted">
              Keep accounts, assets, holdings, liabilities, and workflow actions
              grouped inside one consistent operating surface.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
