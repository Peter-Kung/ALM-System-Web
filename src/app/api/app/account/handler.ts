import { NextResponse, type NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { clearSessionCookie } from "@/lib/auth/session";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createAuthRepository,
  parseAccountUpdatePayload,
  patchAccountForUser,
  type AuthRepository,
} from "@/modules/auth";

type RequireApiSession = typeof requireApiSession;

export type PatchAccountHandlerDependencies = {
  clearSession: typeof clearSessionCookie;
  createRepository: () => AuthRepository;
  requireSession: RequireApiSession;
};

export const defaultPatchAccountHandlerDependencies: PatchAccountHandlerDependencies = {
  clearSession: clearSessionCookie,
  createRepository: createAuthRepository,
  requireSession: requireApiSession,
};

export async function patchAccountHandler(
  request: NextRequest,
  dependencies: PatchAccountHandlerDependencies =
    defaultPatchAccountHandlerDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  try {
    const payload = parseAccountUpdatePayload(await request.json().catch(() => null));

    const result = await patchAccountForUser(
      dependencies.createRepository(),
      {
        userId: session.sub,
        currentPassword: payload.currentPassword,
        displayName: payload.displayName,
        newPassword: payload.newPassword,
        confirmNewPassword: payload.confirmNewPassword,
      },
      dependencies.clearSession,
    );

    return NextResponse.json({ ok: true, signedOut: result.sessionCleared });
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: "Unable to update account settings." },
      { status: 500 },
    );
  }
}
