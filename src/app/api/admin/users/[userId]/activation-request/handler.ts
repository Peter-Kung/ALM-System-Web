import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import {
  createUserManagementRepository,
  requestManagedUserActivation,
  type UserManagementRepository,
} from "@/modules/users";

type RequireApiSession = typeof requireApiSession;

export type AdminUserActivationHandlerDependencies = {
  createRepository: () => UserManagementRepository;
  requireSession: RequireApiSession;
};

const defaultDependencies: AdminUserActivationHandlerDependencies = {
  createRepository: createUserManagementRepository,
  requireSession: requireApiSession,
};

export async function requestUserActivationHandler(
  userId: string,
  dependencies: AdminUserActivationHandlerDependencies = defaultDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await requestManagedUserActivation(
      userId,
      dependencies.createRepository(),
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return handleRouteError(error);
  }
}
