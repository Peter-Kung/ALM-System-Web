import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/auth/session";
import { createAuthRepository } from "@/modules/auth/repository";
import { isBootstrapRequired } from "@/modules/auth/service";

export async function requireApiSession() {
  const repository = createAuthRepository();
  if (await isBootstrapRequired(repository)) {
    return {
      response: NextResponse.json({ error: "Setup required." }, { status: 401 }),
      session: null,
    };
  }

  const session = await getSessionFromCookies();

  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  const user = await repository.findById(session.sub);
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  return { response: null, session };
}
