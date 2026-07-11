import React from "react";
import type { ReactNode } from "react";

import { AccountSettingsForm } from "@/components/account-settings-form";
import { DeploymentSettingsPanel } from "@/components/deployment-settings-panel";
import type { DeploymentState } from "@/modules/deployment";

export function AccountSettingsPageContent({
  accountForm = <AccountSettingsForm />,
  deployment,
  deploymentPanel,
}: {
  accountForm?: ReactNode;
  deployment: DeploymentState | null;
  deploymentPanel?: ReactNode;
}) {
  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Workspace settings</p>
        <h1>Account settings</h1>
        <p className="muted">
          Keep owner sign-in credentials current without changing deployment
          configuration.
        </p>
      </div>

      <div className="account-settings-grid">
        {accountForm}
        <aside className="resource-card stack" aria-label="Account update result">
          <div>
            <p className="eyebrow">Session boundary</p>
            <h2>Re-authentication required</h2>
          </div>
          <p className="muted">
            Successful credential updates end the active session and return this
            browser to sign in again.
          </p>
          <dl className="detail-grid">
            <div>
              <dt>Username</dt>
              <dd>3-32 characters</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>8+ characters</dd>
            </div>
          </dl>
        </aside>
      </div>
      {deployment
        ? deploymentPanel ?? <DeploymentSettingsPanel initialDeployment={deployment} />
        : null}
    </section>
  );
}
