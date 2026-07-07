"use client";

import { FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

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
    <form className="card stack" onSubmit={handleSubmit}>
      <div>
        <h1>Sign in</h1>
        <p className="muted">
          Use the fixed owner credentials configured for this environment.
        </p>
      </div>
      <input name="next" type="hidden" value={nextPath ?? ""} />
      <label className="stack">
        <span>Username</span>
        <input name="username" autoComplete="username" required />
      </label>
      <label className="stack">
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
    </form>
  );
}
