import assert from "node:assert/strict";
import test from "node:test";

import { RepositoryValidationError } from "@/lib/repository-utils";
import { parseAccountUpdatePayload } from "@/modules/auth/account-payload";

test("parseAccountUpdatePayload accepts supported profile and password fields", () => {
  const payload = parseAccountUpdatePayload({
    displayName: "Family Member",
    currentPassword: "current-password",
    newPassword: "new-password",
    confirmNewPassword: "new-password",
  });

  assert.deepEqual(payload, {
    displayName: "Family Member",
    currentPassword: "current-password",
    newPassword: "new-password",
    confirmNewPassword: "new-password",
  });
});

test("parseAccountUpdatePayload preserves blank display names and omits blank password fields", () => {
  const payload = parseAccountUpdatePayload({
    displayName: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  assert.deepEqual(payload, {
    displayName: "",
    currentPassword: undefined,
    newPassword: undefined,
    confirmNewPassword: undefined,
  });
});

test("parseAccountUpdatePayload rejects non-string account update fields", () => {
  assert.throws(
    () =>
      parseAccountUpdatePayload({
        currentPassword: "current-password",
        displayName: ["owner"],
      }),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "displayName must be a string.",
  );
});
