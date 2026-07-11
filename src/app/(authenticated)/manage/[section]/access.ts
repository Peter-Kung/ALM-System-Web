import { canAccessManagementSection } from "@/lib/navigation";
import { getSessionFromCookies } from "@/lib/auth/session";
import { validateSessionPayload } from "@/modules/auth";
import { createAuthRepository } from "@/modules/auth/repository";

export async function canCurrentUserAccessManagementSection(section: string) {
  if (section !== "users") {
    return canAccessManagementSection(section, "USER");
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return false;
  }

  const validSession = await validateSessionPayload(session, createAuthRepository());
  return validSession ? canAccessManagementSection(section, validSession.role) : false;
}
