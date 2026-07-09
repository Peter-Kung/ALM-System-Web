import assert from "node:assert/strict";
import test from "node:test";

import { parseLoginPayload } from "@/modules/auth/login-payload";

test("parseLoginPayload accepts the expected string fields", () => {
  const payload = parseLoginPayload({
    username: "owner",
    password: "change-me",
    next: "/dashboard",
  });

  assert.deepEqual(payload, {
    username: "owner",
    password: "change-me",
    next: "/dashboard",
  });
});

test("parseLoginPayload rejects non-string credentials", () => {
  assert.equal(parseLoginPayload({ username: 123, password: "change-me" }), null);
  assert.equal(parseLoginPayload({ username: "owner", password: {} }), null);
});
