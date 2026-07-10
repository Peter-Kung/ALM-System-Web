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
): Promise<AuthUser> {
  const user = await updateAccountCredentials(input, repository);
  await clearSession();
  return user;
}
