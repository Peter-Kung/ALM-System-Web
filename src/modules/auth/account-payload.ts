import { RepositoryValidationError } from "@/lib/repository-utils";

export type AccountUpdatePayload = {
  confirmNewPassword?: string;
  currentPassword: string;
  newPassword?: string;
  username?: string;
};

function readOptionalString(
  payload: Record<string, unknown>,
  key: keyof AccountUpdatePayload,
) {
  const value = payload[key];

  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RepositoryValidationError(`${key} must be a string.`);
  }

  return value;
}

export function parseAccountUpdatePayload(payload: unknown): AccountUpdatePayload {
  if (!payload || typeof payload !== "object") {
    throw new RepositoryValidationError("Account update payload must be an object.");
  }

  const candidate = payload as Record<string, unknown>;
  const currentPassword = candidate.currentPassword;

  if (typeof currentPassword !== "string" || currentPassword.trim().length === 0) {
    throw new RepositoryValidationError("Current password is required.");
  }

  return {
    currentPassword,
    username: readOptionalString(candidate, "username"),
    newPassword: readOptionalString(candidate, "newPassword"),
    confirmNewPassword: readOptionalString(candidate, "confirmNewPassword"),
  };
}
