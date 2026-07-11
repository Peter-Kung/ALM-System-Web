"use client";

import React, { FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";

type LoginRouter = {
  replace(path: Route): void;
  refresh(): void;
};

type LoginFetch = typeof fetch;

export function LoginFormFields({
  nextPath,
  pending,
  error,
}: {
  nextPath?: string;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <>
      <div className="stack">
        <div>
          <p className="eyebrow">Private service sign in</p>
          <h1>Sign in to workspace</h1>
        </div>
        <p className="muted">
          Sign in with the username and password for this private ALM service.
          Successful sign-in returns you to the requested route or the dashboard.
        </p>
      </div>
      <input name="next" type="hidden" value={nextPath ?? ""} />
      <label className="field">
        <span>Username</span>
        <input name="username" autoComplete="username" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </>
  );
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();

  return <LoginFormWithDependencies nextPath={nextPath} router={router} fetcher={fetch} />;
}

export function LoginFormWithDependencies({
  nextPath,
  router,
  fetcher,
}: {
  nextPath?: string;
  router: LoginRouter;
  fetcher: LoginFetch;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runWorkspaceMutation(async () => {
      setError(null);

      const formData = new FormData(form);
      const response = await fetcher("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
          next: formData.get("next"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to sign in.");
        return;
      }

      const payload = (await response.json()) as { next?: string };
      router.replace((payload.next || nextPath || "/dashboard") as Route);
      router.refresh();
    });
  }

  return (
    <form className="card login-card stack" onSubmit={handleSubmit}>
      <LoginFormFields nextPath={nextPath} pending={isPending} error={error} />
    </form>
  );
}
