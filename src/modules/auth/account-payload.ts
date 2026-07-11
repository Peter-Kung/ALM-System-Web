import { RepositoryValidationError } from "@/lib/repository-utils";

export type AccountUpdatePayload = {
  confirmNewPassword?: string;
  currentPassword?: string;
  displayName?: string | null;
  newPassword?: string;
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
  const currentPassword = readOptionalString(candidate, "currentPassword");
  const displayName = candidate.displayName as string | null | undefined;
  if (
    displayName !== undefined &&
    displayName !== null &&
    typeof displayName !== "string"
  ) {
    throw new RepositoryValidationError("displayName must be a string.");
  }

  return {
    currentPassword,
    displayName,
    newPassword: readOptionalString(candidate, "newPassword"),
    confirmNewPassword: readOptionalString(candidate, "confirmNewPassword"),
  };
}
