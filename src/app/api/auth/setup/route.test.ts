import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { setupHandler } from "@/app/api/auth/setup/handler";

test("setupHandler reports that interactive setup is no longer available", async () => {
  const response = await setupHandler(
    new NextRequest("https://example.test/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        username: "owner",
        setupToken: "setup-token",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    }),
  );

  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), {
    error:
      "Interactive setup is disabled. Sign in with APP_USERNAME and APP_PASSWORD at /login.",
  });
});
