import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";

import { env, requireFixedPassword } from "@/lib/env";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createAuthRepository,
  type AuthRepository,
  type AuthUser,
} from "@/modules/auth/repository";

const PASSWORD_SALT_ROUNDS = 12;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export type UpdateAccountCredentialsInput = {
  confirmNewPassword?: string;
  currentPassword: string;
  newPassword?: string;
  userId: string;
  username?: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

async function backfillLegacyOwner(
  repository: AuthRepository,
  user: AuthUser | null,
  password: string,
) {
  const passwordHash = await hashPassword(password);

  if (user) {
    return repository.update(user.id, {
      username: env.fixedUsername,
      passwordHash,
    });
  }

  const firstUser = await repository.findFirstUser();
  if (firstUser) {
    return repository.update(firstUser.id, {
      username: env.fixedUsername,
      passwordHash,
    });
  }

  return repository.create({
    username: env.fixedUsername,
    passwordHash,
  });
}

async function recoverFromBootstrapRace(
  repository: AuthRepository,
  password: string,
  error: unknown,
) {
  const user = await repository.findByUsername(env.fixedUsername);

  if (user?.passwordHash && (await verifyPassword(password, user.passwordHash))) {
    return user;
  }

  throw error;
}

export async function validateOwnerLogin(
  username: string,
  password: string,
  repository: AuthRepository = createAuthRepository(),
) {
  const trimmedUsername = username.trim();
  const user = await repository.findByUsername(trimmedUsername);

  if (user?.passwordHash) {
    const isValid = await verifyPassword(password, user.passwordHash);
    return isValid ? user : null;
  }

  const hashedUser = await repository.findFirstUserWithPasswordHash();
  if (hashedUser) {
    return null;
  }

  if (
    trimmedUsername !== env.fixedUsername ||
    password !== requireFixedPassword()
  ) {
    return null;
  }

  try {
    return await backfillLegacyOwner(repository, user, password);
  } catch (error) {
    return recoverFromBootstrapRace(repository, password, error);
  }
}

function normalizeUsername(username: string) {
  return username.trim();
}

function validateNextUsername(username: string) {
  if (username.length < 3 || username.length > 32 || !USERNAME_PATTERN.test(username)) {
    throw new RepositoryValidationError(
      "Username must be 3 to 32 characters and use only letters, numbers, '.', '_', and '-'.",
    );
  }
}

function validateNextPassword(
  newPassword: string | undefined,
  confirmNewPassword: string | undefined,
) {
  if (!newPassword && !confirmNewPassword) {
    return;
  }

  if (!newPassword || !confirmNewPassword) {
    throw new RepositoryValidationError(
      "New password and confirmation are required to change the password.",
    );
  }

  if (newPassword !== confirmNewPassword) {
    throw new RepositoryValidationError("New password and confirmation must match.");
  }

  if (newPassword.length < 8) {
    throw new RepositoryValidationError("New password must be at least 8 characters.");
  }
}

async function requireCurrentUser(
  repository: AuthRepository,
  userId: string,
) {
  const user = await repository.findById(userId);

  if (!user) {
    throw new RepositoryValidationError("Signed-in user was not found.");
  }

  return user;
}

async function verifyCurrentPassword(
  repository: AuthRepository,
  user: AuthUser,
  currentPassword: string,
) {
  if (user.passwordHash) {
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new RepositoryValidationError("Current password is incorrect.");
    }

    return user;
  }

  if (
    user.username !== env.fixedUsername ||
    currentPassword !== requireFixedPassword()
  ) {
    throw new RepositoryValidationError("Current password is incorrect.");
  }

  try {
    return await backfillLegacyOwner(repository, user, currentPassword);
  } catch (error) {
    return recoverFromBootstrapRace(repository, currentPassword, error);
  }
}

export async function updateAccountCredentials(
  input: UpdateAccountCredentialsInput,
  repository: AuthRepository = createAuthRepository(),
) {
  const currentUser = await requireCurrentUser(repository, input.userId);
  const verifiedUser = await verifyCurrentPassword(
    repository,
    currentUser,
    input.currentPassword,
  );

  const nextUsername = input.username ? normalizeUsername(input.username) : undefined;
  const hasUsernameUpdate = Boolean(
    nextUsername && nextUsername !== verifiedUser.username,
  );
  const hasPasswordUpdate = Boolean(input.newPassword || input.confirmNewPassword);

  if (nextUsername) {
    validateNextUsername(nextUsername);
  }

  validateNextPassword(input.newPassword, input.confirmNewPassword);

  if (!hasUsernameUpdate && !hasPasswordUpdate) {
    throw new RepositoryValidationError("Provide a new username or password.");
  }

  if (hasUsernameUpdate && nextUsername) {
    const existingUser = await repository.findByUsername(nextUsername);
    if (existingUser && existingUser.id !== verifiedUser.id) {
      throw new RepositoryValidationError("That username is already in use.");
    }
  }

  try {
    return await repository.update(verifiedUser.id, {
      username: hasUsernameUpdate ? nextUsername : undefined,
      passwordHash: input.newPassword
        ? await hashPassword(input.newPassword)
        : undefined,
    });
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
