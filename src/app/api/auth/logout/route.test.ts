import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE } from "@/lib/auth/session";

test("POST clears the session cookie on the logout redirect response", async () => {
  const response = await POST(
    new NextRequest("https://example.test/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=active-session`,
      },
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://example.test/login");

  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie ?? "", new RegExp(`${SESSION_COOKIE}=`));
  assert.match(setCookie ?? "", /Max-Age=0/);
  assert.match(setCookie ?? "", /Path=\//);
});
