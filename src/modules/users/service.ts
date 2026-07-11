import { Prisma, UserRole } from "@prisma/client";

import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createUserManagementRepository,
  type ManagedUser,
  type UserManagementRepository,
} from "@/modules/users/repository";

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export type CreateManagedUserInput = {
  isActive: boolean;
  role: UserRole;
  username: string;
};

export type UpdateManagedUserInput = {
  isActive?: boolean;
  role?: UserRole;
};

function normalizeUsername(username: string) {
  return username.trim();
}

function validateUsername(username: string) {
  if (username.length < 3 || username.length > 32 || !USERNAME_PATTERN.test(username)) {
    throw new RepositoryValidationError(
      "Username must be 3 to 32 characters and use only letters, numbers, '.', '_', and '-'.",
    );
  }
}

function serializeUser(user: ManagedUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    sessionVersion: user.sessionVersion,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function ensureUsernameAvailable(
  repository: UserManagementRepository,
  username: string,
) {
  const existingUser = await repository.findByUsername(username);
  if (existingUser) {
    throw new RepositoryValidationError("That username is already in use.");
  }
}

async function ensureLastActiveAdminIsNotRemoved(
  repository: UserManagementRepository,
  currentUser: ManagedUser,
  nextRole: UserRole,
  nextIsActive: boolean,
) {
  if (
    currentUser.role !== "ADMIN" ||
    !currentUser.isActive ||
    (nextRole === "ADMIN" && nextIsActive)
  ) {
    return;
  }

  const activeAdminCount = await repository.countActiveAdmins();
  if (activeAdminCount <= 1) {
    throw new RepositoryValidationError("At least one active admin is required.");
  }
}

export async function listManagedUsers(
  repository: UserManagementRepository = createUserManagementRepository(),
) {
  const users = await repository.list();
  return users.map(serializeUser);
}

export async function createManagedUser(
  input: CreateManagedUserInput,
  repository: UserManagementRepository = createUserManagementRepository(),
) {
  const username = normalizeUsername(input.username);
  validateUsername(username);
  await ensureUsernameAvailable(repository, username);

  try {
    const user = await repository.create({
      username,
      role: input.role,
      isActive: input.isActive,
    });
    return serializeUser(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new RepositoryValidationError("That username is already in use.");
    }

    throw error;
  }
}

export async function updateManagedUser(
  userId: string,
  input: UpdateManagedUserInput,
  repository: UserManagementRepository = createUserManagementRepository(),
) {
  return repository.withTransaction(async (transactionRepository) => {
    const user = await transactionRepository.findById(userId);
    if (!user) {
      throw new RepositoryValidationError("User was not found.");
    }

    const nextRole = input.role ?? user.role;
    const nextIsActive = input.isActive ?? user.isActive;
    const isDeactivation = user.isActive && !nextIsActive;
    const hasRoleUpdate = nextRole !== user.role;
    const hasActiveUpdate = nextIsActive !== user.isActive;

    if (!hasRoleUpdate && !hasActiveUpdate) {
      throw new RepositoryValidationError("Provide a role or active status update.");
    }

    await ensureLastActiveAdminIsNotRemoved(
      transactionRepository,
      user,
      nextRole,
      nextIsActive,
    );

    const updatedUser = await transactionRepository.update(user.id, {
      role: hasRoleUpdate ? nextRole : undefined,
      isActive: hasActiveUpdate ? nextIsActive : undefined,
      sessionVersion: isDeactivation ? { increment: 1 } : undefined,
    });

    return serializeUser(updatedUser);
  });
}

export async function requestManagedUserActivation(
  userId: string,
  repository: UserManagementRepository = createUserManagementRepository(),
) {
  const user = await repository.findById(userId);
  if (!user) {
    throw new RepositoryValidationError("User was not found.");
  }

  return {
    user: serializeUser(user),
    delivery: "pending_self_managed_onboarding" as const,
  };
}

export async function requestManagedUserPasswordReset(
  userId: string,
  repository: UserManagementRepository = createUserManagementRepository(),
) {
  const user = await repository.findById(userId);
  if (!user) {
    throw new RepositoryValidationError("User was not found.");
  }

  return {
    user: serializeUser(user),
    delivery: "pending_self_managed_onboarding" as const,
  };
}
