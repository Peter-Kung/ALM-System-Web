"use client";

import React, { FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";
import type { SelfManagedPasswordTokenType } from "@/modules/auth";

type SelfManagedPasswordRouter = {
  refresh(): void;
  replace(path: Route): void;
};

type SelfManagedPasswordFetch = typeof fetch;

type SelfManagedPasswordMode = "activation" | "reset";

function getModeCopy(mode: SelfManagedPasswordMode) {
  if (mode === "activation") {
    return {
      description:
        "Set a private password for this account. The activation link works once and expires after five minutes.",
      eyebrow: "Account activation",
      invalidTitle: "Activation link unavailable",
      submitLabel: "Activate account",
      submittingLabel: "Activating account...",
      successDescription:
        "The password is saved and the account is ready to sign in.",
      successTitle: "Account activated",
      title: "Create your password",
    };
  }

  return {
    description:
      "Choose a new private password for this account. The reset link works once and expires after five minutes.",
    eyebrow: "Password reset",
    invalidTitle: "Reset link unavailable",
    submitLabel: "Reset password",
    submittingLabel: "Resetting password...",
    successDescription:
      "The password is updated and older sessions were signed out.",
    successTitle: "Password updated",
    title: "Set a new password",
  };
}

export function SelfManagedPasswordFormFields({
  error,
  mode,
  pending,
}: {
  error?: string | null;
  mode: SelfManagedPasswordMode;
  pending: boolean;
}) {
  const copy = getModeCopy(mode);

  return (
    <>
      <div className="stack">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
        </div>
        <p className="muted">{copy.description}</p>
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

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? copy.submittingLabel : copy.submitLabel}
      </button>
    </>
  );
}

export function SelfManagedPasswordInvalidState({
  mode,
}: {
  mode: SelfManagedPasswordMode;
}) {
  const copy = getModeCopy(mode);

  return (
    <section className="card login-card stack">
      <div className="stack">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.invalidTitle}</h1>
        </div>
        <p className="muted">
          This link is missing, expired, already used, or has been replaced. Ask an
          administrator for a new link.
        </p>
      </div>
      <Link className="inline-link" href="/login">
        Return to sign in
      </Link>
    </section>
  );
}

export function SelfManagedPasswordSuccessState({
  mode,
}: {
  mode: SelfManagedPasswordMode;
}) {
  const copy = getModeCopy(mode);

  return (
    <section className="card login-card stack">
      <div className="stack">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.successTitle}</h1>
        </div>
        <p className="success">{copy.successDescription}</p>
      </div>
      <Link className="inline-link" href="/login">
        Continue to sign in
      </Link>
    </section>
  );
}

export function SelfManagedPasswordForm({
  mode,
  token,
  tokenType,
}: {
  mode: SelfManagedPasswordMode;
  token: string;
  tokenType: SelfManagedPasswordTokenType;
}) {
  const router = useRouter();

  return (
    <SelfManagedPasswordFormWithDependencies
      fetcher={fetch}
      mode={mode}
      router={router}
      token={token}
      tokenType={tokenType}
    />
  );
}

export function SelfManagedPasswordFormWithDependencies({
  fetcher,
  mode,
  router,
  token,
  tokenType,
}: {
  fetcher: SelfManagedPasswordFetch;
  mode: SelfManagedPasswordMode;
  router: SelfManagedPasswordRouter;
  token: string;
  tokenType: SelfManagedPasswordTokenType;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    await runWorkspaceMutation(async () => {
      setError(null);

      let response: Response;
      try {
        const formData = new FormData(form);
        response = await fetcher(
          tokenType === "ACCOUNT_ACTIVATION"
            ? "/api/auth/account-activation"
            : "/api/auth/password-reset",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              token,
              password: formData.get("password"),
              confirmPassword: formData.get("confirmPassword"),
            }),
          },
        );
      } catch {
        setError("Unable to save the password right now.");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to save the password right now.");
        return;
      }

      setIsComplete(true);
      form.reset();
      router.refresh();
    });
  }

  if (isComplete) {
    return <SelfManagedPasswordSuccessState mode={mode} />;
  }

  return (
    <form className="card login-card stack" onSubmit={handleSubmit}>
      <SelfManagedPasswordFormFields error={error} mode={mode} pending={isPending} />
    </form>
  );
}
