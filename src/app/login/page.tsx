import type { Route } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { LoginPageFrame } from "@/components/login-page-frame";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isBootstrapRequired, validateSessionPayload } from "@/modules/auth";
import { createAuthRepository } from "@/modules/auth/repository";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const repository = createAuthRepository();
  const session = await getSessionFromCookies();
  const bootstrapRequired = await isBootstrapRequired(repository);
  if (bootstrapRequired) {
    redirect("/setup");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextPath =
    resolvedSearchParams?.next &&
    resolvedSearchParams.next.startsWith("/") &&
    !resolvedSearchParams.next.startsWith("//")
      ? resolvedSearchParams.next
      : "/dashboard";

  const validSession = await validateSessionPayload(session, repository);
  if (validSession) {
    redirect(nextPath as Route);
  }

  return (
    <main className="login-page">
      <WorkspaceMutationBoundary>
        <LoginPageFrame>
          <LoginForm nextPath={nextPath} />
        </LoginPageFrame>
      </WorkspaceMutationBoundary>
    </main>
  );
}
