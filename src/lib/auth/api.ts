import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/auth/session";

export async function requireApiSession() {
  const session = await getSessionFromCookies();

  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  return { response: null, session };
}
