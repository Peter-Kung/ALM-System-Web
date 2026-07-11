import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";

import { env, getConfiguredAdminCredentials, requireFixedPassword } from "@/lib/env";
import type { SessionPayload } from "@/lib/auth/token";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createAuthRepository,
  type AuthRepository,
  type AuthUser,
} from "@/modules/auth/repository";
import {
  consumeUserActionToken,
  type UserActionTokenRepository,
} from "@/modules/auth/action-token";

const PASSWORD_SALT_ROUNDS = 12;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export type UpdateAccountCredentialsInput = {
  confirmNewPassword?: string;
  currentPassword: string;
  newPassword?: string;
  userId: string;
  username?: string;
};

export type CreateFirstAdministratorInput = {
  confirmPassword: string;
  password: string;
  username: string;
};

export type ActivateAccountInput = {
  confirmPassword: string;
  password: string;
  token: string;
};

export type AuthenticatedUserSession = SessionPayload;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export {
  consumeUserActionToken,
  expireUserActionTokens,
  issueUserActionToken,
  validateUserActionToken,
} from "@/modules/auth/action-token";

async function backfillLegacyOwner(
  repository: AuthRepository,
  user: AuthUser,
  password: string,
) {
  const passwordHash = await hashPassword(password);
  return repository.update(user.id, {
    username: env.fixedUsername,
    passwordHash,
    role: "ADMIN",
    isActive: true,
  });
}

export async function ensureConfiguredAdministrator(
  repository: AuthRepository = createAuthRepository(),
) {
  const configuredAdmin = getConfiguredAdminCredentials();
  if (!configuredAdmin) {
    return null;
  }

  const firstUser = await repository.findFirstUser();
  if (!firstUser) {
    return repository.createFirstAdministrator({
      username: configuredAdmin.username,
      passwordHash: await hashPassword(configuredAdmin.password),
    });
  }

  if (
    !firstUser.passwordHash &&
    (firstUser.username === env.fixedUsername ||
      firstUser.username === configuredAdmin.username)
  ) {
    return repository.update(firstUser.id, {
      username: configuredAdmin.username,
      passwordHash: await hashPassword(configuredAdmin.password),
      role: "ADMIN",
      isActive: true,
    });
  }

  return firstUser;
}

export async function validateOwnerLogin(
  username: string,
  password: string,
  repository: AuthRepository = createAuthRepository(),
) {
  await ensureConfiguredAdministrator(repository);
  const trimmedUsername = username.trim();
  const user = await repository.findByUsername(trimmedUsername);

  if (user && !user.passwordHash) {
    const hashedUser = await repository.findFirstUserWithPasswordHash();
    if (
      !hashedUser &&
      trimmedUsername === env.fixedUsername &&
      password === requireFixedPassword()
    ) {
      return backfillLegacyOwner(repository, user, password);
    }
  }

  if (!user?.passwordHash || !user.isActive) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return repository.update(user.id, { lastLoginAt: new Date() });
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

export async function isBootstrapRequired(
  repository: AuthRepository = createAuthRepository(),
) {
  await ensureConfiguredAdministrator(repository);
  return (await repository.findFirstUser()) === null;
}

export async function createFirstAdministrator(
  input: CreateFirstAdministratorInput,
  repository: AuthRepository = createAuthRepository(),
) {
  const existingUser = await repository.findFirstUser();
  if (existingUser) {
    throw new RepositoryValidationError("Setup is already complete.");
  }

  const username = normalizeUsername(input.username);
  validateNextUsername(username);
  validateNextPassword(input.password, input.confirmPassword);

  try {
    return await repository.createFirstAdministrator({
      username,
      passwordHash: await hashPassword(input.password),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new RepositoryValidationError("Setup is already complete.");
    }

    throw error;
  }
}

export async function activateAccountFromToken(
  input: ActivateAccountInput,
  repository: AuthRepository & UserActionTokenRepository = createAuthRepository(),
  now: Date = new Date(),
) {
  validateNextPassword(input.password, input.confirmPassword);
  const passwordHash = await hashPassword(input.password);

  return repository.withTransaction(async (transactionRepository) => {
    const authTransactionRepository =
      transactionRepository as AuthRepository & UserActionTokenRepository;
    const consumedToken = await consumeUserActionToken(
      input.token,
      "ACCOUNT_ACTIVATION",
      authTransactionRepository,
      now,
    );
    if (!consumedToken) {
      throw new RepositoryValidationError("Activation link is invalid or expired.");
    }

    const user = await authTransactionRepository.findById(consumedToken.userId);
    if (!user) {
      throw new RepositoryValidationError("Activation link is invalid or expired.");
    }

    return authTransactionRepository.update(user.id, {
      isActive: true,
      passwordHash,
      sessionVersion: user.passwordHash ? { increment: 1 } : undefined,
    });
  });
}

export async function validateSessionPayload(
  session: SessionPayload | null,
  repository: AuthRepository = createAuthRepository(),
) {
  if (!session) {
    return null;
  }

  const user = await repository.findById(session.sub);
  if (!user?.isActive || user.sessionVersion !== session.sessionVersion) {
    return null;
  }

  return {
    sub: user.id,
    username: user.username,
    role: user.role,
    sessionVersion: user.sessionVersion,
  } satisfies AuthenticatedUserSession;
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
    user.username === env.fixedUsername &&
    currentPassword === requireFixedPassword()
  ) {
    const hashedUser = await repository.findFirstUserWithPasswordHash();
    if (!hashedUser) {
      return backfillLegacyOwner(repository, user, currentPassword);
    }
  }

  throw new RepositoryValidationError("Current password is incorrect.");
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
      sessionVersion: input.newPassword ? { increment: 1 } : undefined,
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
