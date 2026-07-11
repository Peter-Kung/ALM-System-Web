import React from "react";

import { AccountSettingsPageContent } from "@/components/account-settings-page-content";
import { getSessionFromCookies } from "@/lib/auth/session";
import { validateSessionPayload } from "@/modules/auth";
import { createAuthRepository } from "@/modules/auth/repository";
import { getDeploymentState } from "@/modules/deployment";
import { deploymentControlsEnabled } from "@/modules/deployment/runtime";

export default async function AccountSettingsPage() {
  const session = await getSessionFromCookies();
  const validSession = session
    ? await validateSessionPayload(session, createAuthRepository())
    : null;
  const deployment =
    validSession?.role === "ADMIN" && deploymentControlsEnabled()
      ? await getDeploymentState()
      : null;

  return (
    <AccountSettingsPageContent
      deployment={deployment}
      profile={{
        displayName: validSession?.displayName ?? null,
        username: validSession?.username ?? "",
      }}
    />
  );
}
