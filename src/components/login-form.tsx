"use client";

import React, { FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

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
          <p className="eyebrow">Owner sign in</p>
          <h1>Sign in to workspace</h1>
        </div>
        <p className="muted">
          Use the current owner credentials for this environment. Successful sign-in
          returns you to the requested route or the dashboard.
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
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
      setPending(false);
      return;
    }

    const payload = (await response.json()) as { next?: string };
    router.replace((payload.next || nextPath || "/dashboard") as Route);
    router.refresh();
  }

  return (
    <form className="card login-card stack" onSubmit={handleSubmit}>
      <LoginFormFields nextPath={nextPath} pending={pending} error={error} />
    </form>
  );
}
