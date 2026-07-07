import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { validateFixedUserLogin } from "@/lib/auth/fixed-user";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | { username?: string; password?: string; next?: string }
    | null;

  if (!payload?.username || !payload?.password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  const user = await validateFixedUserLogin(payload.username, payload.password);
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
