import {
  type AuthRepository,
  type AuthUser,
} from "@/modules/auth/repository";
import {
  type UpdateAccountCredentialsInput,
  updateAccountCredentials,
} from "@/modules/auth/service";

export async function patchAccountForUser(
  repository: AuthRepository,
  input: UpdateAccountCredentialsInput,
  clearSession: () => Promise<void>,
): Promise<{ sessionCleared: boolean; user: AuthUser }> {
  const user = await updateAccountCredentials(input, repository);
  const sessionCleared = Boolean(input.newPassword || input.confirmNewPassword);
  if (sessionCleared) {
    await clearSession();
  }

  return {
    sessionCleared,
    user,
  };
}
