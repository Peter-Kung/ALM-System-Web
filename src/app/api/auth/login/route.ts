import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { parseLoginPayload, validateOwnerLogin } from "@/modules/auth";

export async function POST(request: NextRequest) {
  const payload = parseLoginPayload(await request.json().catch(() => null));

  if (!payload?.username || !payload?.password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  const user = await validateOwnerLogin(payload.username, payload.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    username: user.username,
  });

  await setSessionCookie(token);

  return NextResponse.json({
    ok: true,
    next:
      payload.next && payload.next.startsWith("/") && !payload.next.startsWith("//")
        ? payload.next
        : "/dashboard",
  });
}
