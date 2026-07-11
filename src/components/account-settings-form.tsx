"use client";

import React, { FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";

type AccountSettingsRouter = {
  replace(path: Route): void;
  refresh(): void;
};

type AccountSettingsFetch = typeof fetch;

export function AccountSettingsFormFields({
  currentDisplayName,
  currentUsername,
  pending,
  error,
  statusMessage,
}: {
  currentDisplayName: string | null;
  currentUsername: string;
  pending: boolean;
  error?: string | null;
  statusMessage?: string | null;
}) {
  return (
    <>
      <div className="stack">
        <div>
          <p className="eyebrow">Profile and sign-in</p>
          <h2>Account settings</h2>
        </div>
        <p className="muted">
          Update the display name used around the workspace. Password changes
          still require re-authentication, but your username stays fixed.
        </p>
      </div>

      <label className="field">
        <span>Display name</span>
        <input
          name="displayName"
          autoComplete="nickname"
          defaultValue={currentDisplayName ?? ""}
          maxLength={64}
          placeholder="Add the name you want shown in the app"
        />
      </label>

      <div className="detail-grid" aria-label="Account identity">
        <div>
          <dt>Username</dt>
          <dd>{currentUsername}</dd>
        </div>
      </div>

      <label className="field">
        <span>Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>New password</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
          />
        </label>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {statusMessage ? <p className="muted">{statusMessage}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Saving settings..." : "Save settings"}
      </button>
    </>
  );
}

export function AccountSettingsForm({
  currentDisplayName,
  currentUsername,
}: {
  currentDisplayName: string | null;
  currentUsername: string;
}) {
  const router = useRouter();

  return (
    <AccountSettingsFormWithDependencies
      currentDisplayName={currentDisplayName}
      currentUsername={currentUsername}
      router={router}
      fetcher={fetch}
    />
  );
}

export function AccountSettingsFormWithDependencies({
  currentDisplayName,
  currentUsername,
  router,
  fetcher,
}: {
  currentDisplayName: string | null;
  currentUsername: string;
  router: AccountSettingsRouter;
  fetcher: AccountSettingsFetch;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runWorkspaceMutation(async () => {
      setError(null);
      setStatusMessage(null);

      const formData = new FormData(form);
      let response: Response;

      try {
        response = await fetcher("/api/app/account", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            displayName: formData.get("displayName"),
            currentPassword: formData.get("currentPassword"),
            newPassword: formData.get("newPassword"),
            confirmNewPassword: formData.get("confirmNewPassword"),
          }),
        });
      } catch {
        setError("Unable to update account settings.");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to update account settings.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { signedOut?: boolean }
        | null;

      if (payload?.signedOut) {
        form.reset();
        router.replace("/login");
      } else {
        const currentPassword = form.elements.namedItem(
          "currentPassword",
        ) as HTMLInputElement | null;
        const newPassword = form.elements.namedItem("newPassword") as HTMLInputElement | null;
        const confirmNewPassword = form.elements.namedItem(
          "confirmNewPassword",
        ) as HTMLInputElement | null;
        if (currentPassword) {
          currentPassword.value = "";
        }
        if (newPassword) {
          newPassword.value = "";
        }
        if (confirmNewPassword) {
          confirmNewPassword.value = "";
        }
        setStatusMessage("Profile updated.");
      }

      router.refresh();
    });
  }

  return (
    <form className="card account-settings-card stack" onSubmit={handleSubmit}>
      <AccountSettingsFormFields
        currentDisplayName={currentDisplayName}
        currentUsername={currentUsername}
        pending={isPending}
        error={error}
        statusMessage={statusMessage}
      />
    </form>
  );
}
