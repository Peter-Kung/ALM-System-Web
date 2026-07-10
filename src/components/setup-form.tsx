"use client";

import React, { FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";

type SetupRouter = {
  replace(path: Route): void;
  refresh(): void;
};

type SetupFetch = typeof fetch;

export function SetupFormFields({
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
          <p className="eyebrow">First-run setup</p>
          <h1>Create administrator</h1>
        </div>
        <p className="muted">
          Create the first administrator account for this installation. Setup closes
          permanently after the account is saved.
        </p>
      </div>
      <label className="field">
        <span>Username</span>
        <input name="username" autoComplete="username" required />
      </label>
      <label className="field">
        <span>Setup token</span>
        <input name="setupToken" type="password" autoComplete="off" required />
      </label>
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
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create administrator"}
      </button>
    </>
  );
}

export function SetupForm() {
  const router = useRouter();

  return <SetupFormWithDependencies router={router} fetcher={fetch} />;
}

export function SetupFormWithDependencies({
  router,
  fetcher,
}: {
  router: SetupRouter;
  fetcher: SetupFetch;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runWorkspaceMutation(async () => {
      setError(null);

      const formData = new FormData(form);
      const response = await fetcher("/api/auth/setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: formData.get("username"),
          setupToken: formData.get("setupToken"),
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to create administrator.");
        return;
      }

      const payload = (await response.json()) as { next?: string };
      router.replace((payload.next || "/dashboard") as Route);
      router.refresh();
    });
  }

  return (
    <form className="card login-card stack" onSubmit={handleSubmit}>
      <SetupFormFields pending={isPending} error={error} />
    </form>
  );
}
