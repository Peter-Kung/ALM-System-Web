import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { clearSessionCookie } from "@/lib/auth/session";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createAuthRepository,
  parseAccountUpdatePayload,
  type UpdateAccountCredentialsInput,
  updateAccountCredentials,
  type AuthRepository,
} from "@/modules/auth";

export async function patchAccountForUser(
  repository: AuthRepository,
  input: UpdateAccountCredentialsInput,
  clearSession: () => Promise<void>,
) {
  const user = await updateAccountCredentials(input, repository);
  await clearSession();
  return user;
}

export async function PATCH(request: NextRequest) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const payload = parseAccountUpdatePayload(await request.json().catch(() => null));

    await patchAccountForUser(
      createAuthRepository(),
      {
        userId: session.sub,
        currentPassword: payload.currentPassword,
        username: payload.username,
        newPassword: payload.newPassword,
        confirmNewPassword: payload.confirmNewPassword,
      },
      clearSessionCookie,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: "Unable to update account credentials." },
      { status: 500 },
    );
  }
}
