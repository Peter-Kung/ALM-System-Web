import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { completeAccountActivationHandler } from "@/app/api/auth/account-activation/handler";
import { RepositoryValidationError } from "@/lib/repository-utils";

test("completeAccountActivationHandler saves a password from a valid activation token", async () => {
  const requests: Array<{
    confirmPassword: string;
    password: string;
    token: string;
    tokenType: string;
  }> = [];

  const response = await completeAccountActivationHandler(
    new NextRequest("https://example.test/api/auth/account-activation", {
      method: "POST",
      body: JSON.stringify({
        token: "activation-token",
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
      token: "activation-token",
      password: "family-password",
      confirmPassword: "family-password",
      tokenType: "ACCOUNT_ACTIVATION",
    },
  ]);
});

test("completeAccountActivationHandler rejects incomplete payloads", async () => {
  const response = await completeAccountActivationHandler(
    new NextRequest("https://example.test/api/auth/account-activation", {
      method: "POST",
      body: JSON.stringify({
        token: "activation-token",
        password: "family-password",
      }),
      headers: {
        "content-type": "application/json",
      },
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Token, password, and confirmation are required.",
  });
});

test("completeAccountActivationHandler returns safe validation errors", async () => {
  const response = await completeAccountActivationHandler(
    new NextRequest("https://example.test/api/auth/account-activation", {
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
