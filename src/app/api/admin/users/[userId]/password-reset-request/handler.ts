import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import {
  createUserManagementRepository,
  requestManagedUserPasswordReset,
  type UserManagementRepository,
} from "@/modules/users";

type RequireApiSession = typeof requireApiSession;

export type AdminUserPasswordResetHandlerDependencies = {
  createRepository: () => UserManagementRepository;
  requireSession: RequireApiSession;
};

const defaultDependencies: AdminUserPasswordResetHandlerDependencies = {
  createRepository: createUserManagementRepository,
  requireSession: requireApiSession,
};

export async function requestUserPasswordResetHandler(
  userId: string,
  dependencies: AdminUserPasswordResetHandlerDependencies = defaultDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await requestManagedUserPasswordReset(
      userId,
      dependencies.createRepository(),
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return handleRouteError(error);
  }
}
