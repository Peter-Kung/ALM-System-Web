import { AccountActivationForm } from "@/components/account-activation-form";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="card login-card stack">
          <div>
            <p className="eyebrow">Account activation</p>
            <h1>Activation link missing</h1>
          </div>
          <p className="muted">
            Ask an administrator to send you a new activation link through Telegram.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <AccountActivationForm token={token} />
    </main>
  );
}
