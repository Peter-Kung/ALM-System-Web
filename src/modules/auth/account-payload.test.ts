import assert from "node:assert/strict";
import test from "node:test";

import { RepositoryValidationError } from "@/lib/repository-utils";
import { parseAccountUpdatePayload } from "@/modules/auth/account-payload";

test("parseAccountUpdatePayload accepts the supported credential update fields", () => {
  const payload = parseAccountUpdatePayload({
    currentPassword: "current-password",
    username: "owner.next",
    newPassword: "new-password",
    confirmNewPassword: "new-password",
  });

  assert.deepEqual(payload, {
    currentPassword: "current-password",
    username: "owner.next",
    newPassword: "new-password",
    confirmNewPassword: "new-password",
  });
});

test("parseAccountUpdatePayload treats blank optional fields as omitted", () => {
  const payload = parseAccountUpdatePayload({
    currentPassword: "current-password",
    username: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  assert.deepEqual(payload, {
    currentPassword: "current-password",
    username: undefined,
    newPassword: undefined,
    confirmNewPassword: undefined,
  });
});

test("parseAccountUpdatePayload requires a non-empty current password", () => {
  assert.throws(
    () => parseAccountUpdatePayload({ currentPassword: "" }),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Current password is required.",
  );
});

test("parseAccountUpdatePayload rejects non-string credential update fields", () => {
  assert.throws(
    () =>
      parseAccountUpdatePayload({
        currentPassword: "current-password",
        username: ["owner"],
      }),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "username must be a string.",
  );
});
