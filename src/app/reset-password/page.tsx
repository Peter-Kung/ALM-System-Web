import { LoginPageFrame } from "@/components/login-page-frame";
import {
  SelfManagedPasswordForm,
  SelfManagedPasswordInvalidState,
} from "@/components/self-managed-password-form";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { createAuthRepository, readSelfManagedPasswordLink } from "@/modules/auth";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const repository = createAuthRepository();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token = typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams.token : "";
  const link = await readSelfManagedPasswordLink(token, "PASSWORD_RESET", repository);

  return (
    <main className="login-page">
      <WorkspaceMutationBoundary>
        <LoginPageFrame>
          {link ? (
            <SelfManagedPasswordForm
              mode="reset"
              token={token}
              tokenType="PASSWORD_RESET"
            />
          ) : (
            <SelfManagedPasswordInvalidState mode="reset" />
          )}
        </LoginPageFrame>
      </WorkspaceMutationBoundary>
    </main>
  );
}
