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
  pending,
  error,
}: {
  pending: boolean;
  error?: string | null;
}) {
  return (
    <>
      <div className="stack">
        <div>
          <p className="eyebrow">Owner credentials</p>
          <h2>Account sign-in</h2>
        </div>
        <p className="muted">
          Change the username, password, or both. Any saved change signs out the
          current session.
        </p>
      </div>

      <label className="field">
        <span>New username</span>
        <input
          name="username"
          autoComplete="username"
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9._-]+"
        />
      </label>

      <label className="field">
        <span>Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
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

      <button type="submit" disabled={pending}>
        {pending ? "Saving account..." : "Save account"}
      </button>
    </>
  );
}

export function AccountSettingsForm() {
  const router = useRouter();

  return <AccountSettingsFormWithDependencies router={router} fetcher={fetch} />;
}

export function AccountSettingsFormWithDependencies({
  router,
  fetcher,
}: {
  router: AccountSettingsRouter;
  fetcher: AccountSettingsFetch;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runWorkspaceMutation(async () => {
      setError(null);

      const formData = new FormData(form);
      let response: Response;

      try {
        response = await fetcher("/api/app/account", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            username: formData.get("username"),
            currentPassword: formData.get("currentPassword"),
            newPassword: formData.get("newPassword"),
            confirmNewPassword: formData.get("confirmNewPassword"),
          }),
        });
      } catch {
        setError("Unable to update account credentials.");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to update account credentials.");
        return;
      }

      form.reset();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <form className="card account-settings-card stack" onSubmit={handleSubmit}>
      <AccountSettingsFormFields pending={isPending} error={error} />
    </form>
  );
}
