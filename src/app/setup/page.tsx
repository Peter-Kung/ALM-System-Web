import { redirect } from "next/navigation";

import { LoginPageFrame } from "@/components/login-page-frame";
import { SetupForm } from "@/components/setup-form";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isBootstrapRequired } from "@/modules/auth";

export default async function SetupPage() {
  const session = await getSessionFromCookies();
  const bootstrapRequired = await isBootstrapRequired();
  if (!bootstrapRequired) {
    if (session) {
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
