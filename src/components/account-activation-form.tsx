"use client";

import React, { FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";

type ActivationRouter = {
  replace(path: Route): void;
  refresh(): void;
};

type ActivationFetch = typeof fetch;

export function AccountActivationForm({
  token,
}: {
  token: string;
}) {
  const router = useRouter();

  return (
    <AccountActivationFormWithDependencies
      token={token}
      router={router}
      fetcher={fetch}
    />
  );
}

export function AccountActivationFormWithDependencies({
  token,
  router,
  fetcher,
}: {
  token: string;
  router: ActivationRouter;
  fetcher: ActivationFetch;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runWorkspaceMutation(async () => {
      setError(null);

      const formData = new FormData(form);
      const response = await fetcher("/api/auth/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to activate account.");
        return;
      }

      const payload = (await response.json()) as { next?: string };
      router.replace((payload.next || "/login") as Route);
      router.refresh();
    });
  }

  return (
    <form className="card login-card stack" onSubmit={handleSubmit}>
      <div className="stack">
        <div>
          <p className="eyebrow">Account activation</p>
          <h1>Set your password</h1>
        </div>
        <p className="muted">
          Save a password for your ALM account. This activation link expires after
          5 minutes and can only be used once.
        </p>
      </div>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Activate account"}
      </button>
    </form>
  );
}
