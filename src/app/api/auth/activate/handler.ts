import { NextRequest, NextResponse } from "next/server";

import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  activateAccountFromToken,
  createAuthRepository,
  type AuthRepository,
  type UserActionTokenRepository,
} from "@/modules/auth";

type ActivateDependencies = {
  createRepository(): AuthRepository & UserActionTokenRepository;
};

const defaultDependencies: ActivateDependencies = {
  createRepository: createAuthRepository,
};

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  return origin === new URL(request.url).origin;
}

export async function activateAccountHandler(
  request: NextRequest,
  dependencies: ActivateDependencies = defaultDependencies,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Activation requests must use JSON." },
      { status: 415 },
    );
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid activation request." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    confirmPassword?: unknown;
    password?: unknown;
    token?: unknown;
  } | null;

  if (
    typeof payload?.token !== "string" ||
    typeof payload.password !== "string" ||
    typeof payload.confirmPassword !== "string"
  ) {
    return NextResponse.json(
      { error: "Activation token, password, and confirmation are required." },
      { status: 400 },
    );
  }

  try {
    await activateAccountFromToken(
      {
        token: payload.token,
        password: payload.password,
        confirmPassword: payload.confirmPassword,
      },
      dependencies.createRepository(),
    );

    return NextResponse.json({ ok: true, next: "/login" });
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
