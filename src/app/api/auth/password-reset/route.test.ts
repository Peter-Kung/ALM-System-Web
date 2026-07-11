import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { completePasswordResetHandler } from "@/app/api/auth/password-reset/handler";
import { RepositoryValidationError } from "@/lib/repository-utils";

test("completePasswordResetHandler saves a password from a valid reset token", async () => {
  const requests: Array<{
    confirmPassword: string;
    password: string;
    token: string;
    tokenType: string;
  }> = [];

  const response = await completePasswordResetHandler(
    new NextRequest("https://example.test/api/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({
        token: "reset-token",
        password: "family-password",
        confirmPassword: "family-password",
      }),
      headers: {
        "content-type": "application/json",
      },
    }),
    {
      async completePassword(input) {
        requests.push(input);
      },
      createRepository() {
        return {} as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, next: "/login" });
  assert.deepEqual(requests, [
    {
      token: "reset-token",
      password: "family-password",
      confirmPassword: "family-password",
      tokenType: "PASSWORD_RESET",
    },
  ]);
});

test("completePasswordResetHandler rejects invalid or expired links", async () => {
  const response = await completePasswordResetHandler(
    new NextRequest("https://example.test/api/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({
        token: "expired-token",
        password: "family-password",
        confirmPassword: "family-password",
      }),
      headers: {
        "content-type": "application/json",
      },
    }),
    {
      async completePassword() {
        throw new RepositoryValidationError("That link is invalid or expired.");
      },
      createRepository() {
        return {} as never;
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "That link is invalid or expired.",
  });
});
