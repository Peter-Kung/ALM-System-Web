import { NextRequest, NextResponse } from "next/server";

import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  completeSelfManagedPassword,
  createAuthRepository,
  type AuthRepository,
  type SelfManagedPasswordTokenType,
  type UserActionTokenRepository,
} from "@/modules/auth";

type SelfManagedPasswordRepository = AuthRepository & UserActionTokenRepository;

type CompleteSelfManagedPasswordDependencies = {
  completePassword(
    input: {
      confirmPassword: string;
      password: string;
      token: string;
      tokenType: SelfManagedPasswordTokenType;
    },
    repository: SelfManagedPasswordRepository,
  ): Promise<unknown>;
  createRepository(): SelfManagedPasswordRepository;
};

const defaultDependencies: CompleteSelfManagedPasswordDependencies = {
  completePassword: completeSelfManagedPassword,
  createRepository: createAuthRepository,
};

export async function completePasswordResetHandler(
  request: NextRequest,
  dependencies: CompleteSelfManagedPasswordDependencies = defaultDependencies,
) {
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
      { error: "Token, password, and confirmation are required." },
      { status: 400 },
    );
  }

  try {
    await dependencies.completePassword(
      {
        token: payload.token,
        password: payload.password,
        confirmPassword: payload.confirmPassword,
        tokenType: "PASSWORD_RESET",
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
