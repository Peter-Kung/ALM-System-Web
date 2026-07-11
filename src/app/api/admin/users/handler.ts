import { UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import {
  getBooleanValue,
  getEnumValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import {
  createManagedUser,
  createUserManagementRepository,
  listManagedUsers,
  type UserManagementRepository,
} from "@/modules/users";

type RequireApiSession = typeof requireApiSession;

export type AdminUsersHandlerDependencies = {
  createRepository: () => UserManagementRepository;
  requireSession: RequireApiSession;
};

const defaultDependencies: AdminUsersHandlerDependencies = {
  createRepository: createUserManagementRepository,
  requireSession: requireApiSession,
};

async function requireAdminSession(dependencies: AdminUsersHandlerDependencies) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function listUsersHandler(
  dependencies: AdminUsersHandlerDependencies = defaultDependencies,
) {
  const response = await requireAdminSession(dependencies);
  if (response) {
    return response;
  }

  try {
    const users = await listManagedUsers(dependencies.createRepository());
    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function createUserHandler(
  request: NextRequest,
  dependencies: AdminUsersHandlerDependencies = defaultDependencies,
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

    const user = await createManagedUser(
      {
        username: getStringValue(payload, "username"),
        role: getEnumValue(payload, "role", Object.values(UserRole)),
        isActive: getBooleanValue(payload, "isActive"),
      },
      dependencies.createRepository(),
    );

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
