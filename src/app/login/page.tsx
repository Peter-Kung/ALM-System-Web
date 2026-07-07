import type { Route } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSessionFromCookies } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const session = await getSessionFromCookies();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextPath =
    resolvedSearchParams?.next &&
    resolvedSearchParams.next.startsWith("/") &&
    !resolvedSearchParams.next.startsWith("//")
      ? resolvedSearchParams.next
      : "/dashboard";

  if (session) {
    redirect(nextPath as Route);
  }

  return (
    <main className="login-page">
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
