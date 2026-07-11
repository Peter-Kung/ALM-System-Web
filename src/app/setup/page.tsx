import { redirect } from "next/navigation";

import { LoginPageFrame } from "@/components/login-page-frame";
import { SetupForm } from "@/components/setup-form";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isBootstrapRequired, validateSessionPayload } from "@/modules/auth";
import { createAuthRepository } from "@/modules/auth/repository";

export default async function SetupPage() {
  const repository = createAuthRepository();
  const session = await getSessionFromCookies();
  const bootstrapRequired = await isBootstrapRequired(repository);
  if (!bootstrapRequired) {
    const validSession = await validateSessionPayload(session, repository);
    if (validSession) {
      redirect("/dashboard");
    }

    redirect("/login");
  }

  return (
    <main className="login-page">
      <WorkspaceMutationBoundary>
        <LoginPageFrame>
          <SetupForm />
        </LoginPageFrame>
      </WorkspaceMutationBoundary>
    </main>
  );
}
