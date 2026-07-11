import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import type { UserActionTokenType } from "@prisma/client";

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
  validateUserActionToken,
  type UserActionTokenRepository,
} from "@/modules/auth/action-token";

const PASSWORD_SALT_ROUNDS = 12;
export type UpdateAccountCredentialsInput = {
  confirmNewPassword?: string;
  currentPassword?: string;
  displayName?: string | null;
  newPassword?: string;
  userId: string;
};

export type CreateFirstAdministratorInput = {
  confirmPassword: string;
  password: string;
  username: string;
};

export type AuthenticatedUserSession = SessionPayload & {
  displayName: string | null;
};

export type SelfManagedPasswordTokenType = Extract<
  UserActionTokenType,
  "ACCOUNT_ACTIVATION" | "PASSWORD_RESET"
>;

export type CompleteSelfManagedPasswordInput = {
  confirmPassword: string;
  password: string;
  token: string;
  tokenType: SelfManagedPasswordTokenType;
};

export type SelfManagedPasswordLink = {
  expiresAt: Date;
  tokenType: SelfManagedPasswordTokenType;
  userId: string;
  username: string;
};

type SelfManagedPasswordRepository = AuthRepository & UserActionTokenRepository;

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
  if (username.length < 3 || username.length > 32 || !/^[A-Za-z0-9._-]+$/.test(username)) {
    throw new RepositoryValidationError(
      "Username must be 3 to 32 characters and use only letters, numbers, '.', '_', and '-'.",
    );
  }
}

function normalizeDisplayName(displayName: string | null | undefined) {
  if (displayName === undefined) {
    return undefined;
  }

  if (displayName === null) {
    return null;
  }

  const normalizedDisplayName = displayName.trim();
  return normalizedDisplayName ? normalizedDisplayName : null;
}

function validateDisplayName(displayName: string | null | undefined) {
  if (displayName && displayName.length > 64) {
    throw new RepositoryValidationError("Display name must be 64 characters or fewer.");
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

function normalizeActionToken(token: string) {
  return token.trim();
}

function createInvalidLinkError() {
  return new RepositoryValidationError("That link is invalid or expired.");
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
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    sessionVersion: user.sessionVersion,
  } satisfies AuthenticatedUserSession;
}

export async function readSelfManagedPasswordLink(
  token: string,
  tokenType: SelfManagedPasswordTokenType,
  repository: SelfManagedPasswordRepository = createAuthRepository(),
  now: Date = new Date(),
): Promise<SelfManagedPasswordLink | null> {
  const normalizedToken = normalizeActionToken(token);
  if (!normalizedToken) {
    return null;
  }

  const actionToken = await validateUserActionToken(
    normalizedToken,
    tokenType,
    repository,
    now,
  );
  if (!actionToken) {
    return null;
  }

  const user = await repository.findById(actionToken.userId);
  if (
    !user ||
    (tokenType === "ACCOUNT_ACTIVATION" && user.isActive) ||
    (tokenType === "PASSWORD_RESET" && !user.isActive)
  ) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    expiresAt: actionToken.expiresAt,
    tokenType,
  };
}

export async function completeSelfManagedPassword(
  input: CompleteSelfManagedPasswordInput,
  repository: SelfManagedPasswordRepository = createAuthRepository(),
  now: Date = new Date(),
) {
  validateNextPassword(input.password, input.confirmPassword);

  const normalizedToken = normalizeActionToken(input.token);
  if (!normalizedToken) {
    throw createInvalidLinkError();
  }

  return repository.withTransaction(async (transactionRepository) => {
    const authRepository = transactionRepository as SelfManagedPasswordRepository;

    const actionLink = await readSelfManagedPasswordLink(
      normalizedToken,
      input.tokenType,
      authRepository,
      now,
    );
    if (!actionLink) {
      throw createInvalidLinkError();
    }

    const consumedToken = await consumeUserActionToken(
      normalizedToken,
      input.tokenType,
      authRepository,
      now,
    );
    if (!consumedToken) {
      throw createInvalidLinkError();
    }

    return authRepository.update(actionLink.userId, {
      isActive: input.tokenType === "ACCOUNT_ACTIVATION" ? true : undefined,
      passwordHash: await hashPassword(input.password),
      sessionVersion:
        input.tokenType === "PASSWORD_RESET" ? { increment: 1 } : undefined,
    });
  });
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
  const nextDisplayName = normalizeDisplayName(input.displayName);
  const hasDisplayNameUpdate =
    input.displayName !== undefined && nextDisplayName !== currentUser.displayName;
  const hasPasswordUpdate = Boolean(input.newPassword || input.confirmNewPassword);
  validateDisplayName(nextDisplayName);
  validateNextPassword(input.newPassword, input.confirmNewPassword);

  if (!hasDisplayNameUpdate && !hasPasswordUpdate) {
    throw new RepositoryValidationError("Provide a display name or password update.");
  }

  let verifiedUser = currentUser;
  if (hasPasswordUpdate) {
    if (!input.currentPassword?.trim()) {
      throw new RepositoryValidationError(
        "Current password is required to change the password.",
      );
    }
    verifiedUser = await verifyCurrentPassword(
      repository,
      currentUser,
      input.currentPassword,
    );
  }

  try {
    return await repository.update(verifiedUser.id, {
      displayName: hasDisplayNameUpdate ? nextDisplayName : undefined,
      passwordHash: input.newPassword
        ? await hashPassword(input.newPassword)
        : undefined,
      sessionVersion: input.newPassword ? { increment: 1 } : undefined,
    });
  } catch (error) {
    throw error;
  }
}
