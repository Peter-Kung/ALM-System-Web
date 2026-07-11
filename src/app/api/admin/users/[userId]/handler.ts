import { UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import {
  getBooleanValue,
  getEnumValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import {
  createUserManagementRepository,
  updateManagedUser,
  type UserManagementRepository,
} from "@/modules/users";

type RequireApiSession = typeof requireApiSession;

export type AdminUserHandlerDependencies = {
  createRepository: () => UserManagementRepository;
  requireSession: RequireApiSession;
};

const defaultDependencies: AdminUserHandlerDependencies = {
  createRepository: createUserManagementRepository,
  requireSession: requireApiSession,
};

async function requireAdminSession(dependencies: AdminUserHandlerDependencies) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function updateUserHandler(
  request: NextRequest,
  userId: string,
  dependencies: AdminUserHandlerDependencies = defaultDependencies,
) {
  const response = await requireAdminSession(dependencies);
  if (response) {
    return response;
  }

  try {
    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if ("password" in payload || "temporaryPassword" in payload) {
      return NextResponse.json(
        { error: "Admins cannot set another user's password." },
        { status: 400 },
      );
    }

    const role =
      "role" in payload
        ? getEnumValue(payload, "role", Object.values(UserRole))
        : undefined;
    const isActive =
      "isActive" in payload ? getBooleanValue(payload, "isActive") : undefined;

    const user = await updateManagedUser(
      userId,
      {
        role,
        isActive,
      },
      dependencies.createRepository(),
    );

    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
