import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { requireSetupToken } from "@/lib/env";
import { RepositoryValidationError } from "@/lib/repository-utils";
import { createFirstAdministrator } from "@/modules/auth";
import { createAuthRepository, type AuthRepository } from "@/modules/auth/repository";

type SetupDependencies = {
  createSessionToken(payload: { sub: string; username: string }): Promise<string>;
  createRepository(): AuthRepository;
  setSession(token: string): Promise<void>;
};

const defaultDependencies: SetupDependencies = {
  createSessionToken,
  createRepository: createAuthRepository,
  setSession: setSessionCookie,
};

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  return origin === new URL(request.url).origin;
}

export async function setupHandler(
  request: NextRequest,
  dependencies: SetupDependencies = defaultDependencies,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Setup requests must use JSON." },
      { status: 415 },
    );
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid setup request." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    confirmPassword?: unknown;
    password?: unknown;
    setupToken?: unknown;
    username?: unknown;
  } | null;

  if (
    typeof payload?.username !== "string" ||
    typeof payload.password !== "string" ||
    typeof payload.confirmPassword !== "string"
  ) {
    return NextResponse.json(
      { error: "Username, password, and confirmation are required." },
      { status: 400 },
    );
  }

  if (payload.setupToken !== requireSetupToken()) {
    return NextResponse.json({ error: "Invalid setup token." }, { status: 403 });
  }

  try {
    const user = await createFirstAdministrator(
      {
        username: payload.username,
        password: payload.password,
        confirmPassword: payload.confirmPassword,
      },
      dependencies.createRepository(),
    );

    const token = await dependencies.createSessionToken({
      sub: user.id,
      username: user.username,
    });
    await dependencies.setSession(token);

    return NextResponse.json({ ok: true, next: "/dashboard" });
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
