import React from "react";
import type { ReactNode } from "react";

import { AccountSettingsForm } from "@/components/account-settings-form";
import { DeploymentSettingsPanel } from "@/components/deployment-settings-panel";
import type { DeploymentState } from "@/modules/deployment";

export function AccountSettingsPageContent({
  accountForm,
  deployment,
  deploymentPanel,
  profile,
}: {
  accountForm?: ReactNode;
  deployment: DeploymentState | null;
  deploymentPanel?: ReactNode;
  profile: {
    displayName: string | null;
    username: string;
  };
}) {
  const resolvedAccountForm = accountForm ?? (
    <AccountSettingsForm
      currentDisplayName={profile.displayName}
      currentUsername={profile.username}
    />
  );

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Workspace settings</p>
        <h1>Account settings</h1>
        <p className="muted">
          Keep your profile details current without changing deployment
          configuration or the username used for sign-in.
        </p>
      </div>

      <div className="account-settings-grid">
        {resolvedAccountForm}
        <aside className="resource-card stack" aria-label="Account update result">
          <div>
            <p className="eyebrow">Account identity</p>
            <h2>Username stays fixed</h2>
          </div>
          <p className="muted">
            Password changes end the active session. Display-name updates stay in
            place without changing how you sign in.
          </p>
          <dl className="detail-grid">
            <div>
              <dt>Username</dt>
              <dd>{profile.username}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>{profile.displayName ?? "Not set"}</dd>
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
