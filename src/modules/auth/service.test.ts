import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma, UserActionTokenType } from "@prisma/client";

import type { AuthRepository, AuthUser } from "@/modules/auth/repository";
import type { UserActionTokenRepository } from "@/modules/auth/action-token";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  completeSelfManagedPassword,
  consumeUserActionToken,
  createFirstAdministrator,
  ensureConfiguredAdministrator,
  expireUserActionTokens,
  hashPassword,
  isBootstrapRequired,
  issueUserActionToken,
  updateAccountCredentials,
  validateUserActionToken,
  readSelfManagedPasswordLink,
  validateOwnerLogin,
  validateSessionPayload,
  verifyPassword,
} from "@/modules/auth/service";

function createAuthUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: "user-1",
    displayName: null,
    username: "owner",
    passwordHash: null,
    role: "ADMIN",
    isActive: true,
    sessionVersion: 0,
    lastLoginAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

function parseOptionalDate(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return new Date(value);
  }

  return null;
}

function createRepositoryFixture(
  initialUsers: Partial<AuthUser>[] = [],
): AuthRepository & UserActionTokenRepository {
  const users = initialUsers.map((user, index) =>
    createAuthUser({
      id: `user-${index + 1}`,
      createdAt: new Date(`2026-07-0${index + 1}T00:00:00Z`),
      ...user,
    }),
  );
  const actionTokens: Array<{
    consumedAt: Date | null;
    createdAt: Date;
    expiresAt: Date;
    id: string;
    invalidatedAt: Date | null;
    tokenHash: string;
    tokenType: UserActionTokenType;
    updatedAt: Date;
    userId: string;
  }> = [];
  let tokenCounter = 0;

  return {
    async findById(id: string) {
      return users.find((user) => user.id === id) ?? null;
    },
    async findByUsername(username: string) {
      return users.find((user) => user.username === username) ?? null;
    },
    async findFirstUser() {
      return users[0] ?? null;
    },
    async findFirstUserWithPasswordHash() {
      return users.find((user) => user.passwordHash) ?? null;
    },
    async create(data: Prisma.UserCreateInput) {
      const user = createAuthUser({
        id: `user-${users.length + 1}`,
        displayName:
          typeof data.displayName === "string" || data.displayName === null
            ? data.displayName
            : null,
        username: data.username,
        passwordHash: data.passwordHash ?? null,
        role: data.role ?? ("ADMIN" as const),
        isActive: data.isActive ?? true,
        sessionVersion: data.sessionVersion ?? 0,
        lastLoginAt: data.lastLoginAt instanceof Date ? data.lastLoginAt : null,
        createdAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
      });
      users.push(user);
      return user;
    },
    async createFirstAdministrator(data: { passwordHash: string; username: string }) {
      const user = createAuthUser({
        id: `user-${users.length + 1}`,
        displayName: null,
        username: data.username,
        passwordHash: data.passwordHash,
        createdAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
      });
      users.push(user);
      return user;
    },
    async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
      const user = users.find((entry) => entry.id === id);
      if (!user) {
        throw new Error(`missing user ${id}`);
      }

      if (typeof data.username === "string") {
        user.username = data.username;
      }

      if (typeof data.displayName === "string" || data.displayName === null) {
        user.displayName = data.displayName;
      }

      if (typeof data.passwordHash === "string") {
        user.passwordHash = data.passwordHash;
      }

      if (data.role === "ADMIN" || data.role === "USER") {
        user.role = data.role;
      }

      if (typeof data.isActive === "boolean") {
        user.isActive = data.isActive;
      }

      if (typeof data.lastLoginAt === "object" && data.lastLoginAt instanceof Date) {
        user.lastLoginAt = data.lastLoginAt;
      }

      if (typeof data.sessionVersion === "number") {
        user.sessionVersion = data.sessionVersion;
      } else if (
        typeof data.sessionVersion === "object" &&
        data.sessionVersion &&
        "increment" in data.sessionVersion &&
        typeof data.sessionVersion.increment === "number"
      ) {
        user.sessionVersion += data.sessionVersion.increment;
      }

      return user;
    },
    async createUserActionToken(data: Prisma.UserActionTokenUncheckedCreateInput) {
      tokenCounter += 1;
      const createdAt = new Date("2026-07-10T00:00:00Z");
      const token = {
        id: `token-${tokenCounter}`,
        userId: data.userId,
        tokenType: data.tokenType,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
        consumedAt: parseOptionalDate(data.consumedAt),
        invalidatedAt: parseOptionalDate(data.invalidatedAt),
        createdAt,
        updatedAt: createdAt,
      };
      actionTokens.push(token);
      return token;
    },
    async expireUserActionTokens(now: Date) {
      let count = 0;
      for (const token of actionTokens) {
        if (
          token.consumedAt === null &&
          token.invalidatedAt === null &&
          token.expiresAt.getTime() <= now.getTime()
        ) {
          token.invalidatedAt = now;
          token.updatedAt = now;
          count += 1;
        }
      }

      return count;
    },
    async findUserActionTokenByHash(tokenHash: string, tokenType: UserActionTokenType) {
      return (
        actionTokens
          .filter((token) => token.tokenHash === tokenHash && token.tokenType === tokenType)
          .sort(
            (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
          )[0] ??
        null
      );
    },
    async invalidateActiveUserActionTokens(
      userId: string,
      tokenType: UserActionTokenType,
      invalidatedAt: Date,
    ) {
      let count = 0;
      for (const token of actionTokens) {
        if (
          token.userId === userId &&
          token.tokenType === tokenType &&
          token.consumedAt === null &&
          token.invalidatedAt === null &&
          token.expiresAt.getTime() > invalidatedAt.getTime()
        ) {
          token.invalidatedAt = invalidatedAt;
          token.updatedAt = invalidatedAt;
          count += 1;
        }
      }

      return count;
    },
    async markUserActionTokenConsumed(tokenId: string, consumedAt: Date) {
      const token = actionTokens.find((entry) => entry.id === tokenId);
      if (
        !token ||
        token.consumedAt !== null ||
        token.invalidatedAt !== null ||
        token.expiresAt.getTime() <= consumedAt.getTime()
      ) {
        return null;
      }

      token.consumedAt = consumedAt;
      token.updatedAt = consumedAt;
      return token;
    },
    async withTransaction<T>(
      operation: (repository: UserActionTokenRepository) => Promise<T>,
    ) {
      return operation(this);
    },
  };
}

test("isBootstrapRequired is true only while the database has no users", async () => {
  const repository = createRepositoryFixture();

  assert.equal(await isBootstrapRequired(repository), true);

  await createFirstAdministrator(
    {
      username: "owner",
      password: "new-password",
      confirmPassword: "new-password",
    },
    repository,
  );

  assert.equal(await isBootstrapRequired(repository), false);
});

test("createFirstAdministrator creates the only first-run admin account", async () => {
  const repository = createRepositoryFixture();

  const user = await createFirstAdministrator(
    {
      username: " owner ",
      password: "new-password",
      confirmPassword: "new-password",
    },
    repository,
  );

  assert.equal(user.username, "owner");
  assert.ok(user.passwordHash);
  assert.equal(user.role, "ADMIN");
  assert.equal(user.isActive, true);
  assert.equal(user.sessionVersion, 0);
  assert.equal(await verifyPassword("new-password", user.passwordHash), true);
  assert.equal(await validateOwnerLogin("owner", "new-password", repository), user);
});

test("ensureConfiguredAdministrator creates the first active admin from deployment config", async () => {
  const originalUsername = process.env.APP_ADMIN_USERNAME;
  const originalPassword = process.env.APP_ADMIN_PASSWORD;
  process.env.APP_ADMIN_USERNAME = "configured-admin";
  process.env.APP_ADMIN_PASSWORD = "configured-password";

  try {
    const repository = createRepositoryFixture();

    const user = await ensureConfiguredAdministrator(repository);

    assert.ok(user);
    assert.equal(user.username, "configured-admin");
    assert.equal(user.role, "ADMIN");
    assert.equal(user.isActive, true);
    assert.equal(user.sessionVersion, 0);
    assert.ok(user.passwordHash);
    assert.equal(
      await validateOwnerLogin("configured-admin", "configured-password", repository),
      user,
    );
  } finally {
    if (originalUsername === undefined) {
      delete process.env.APP_ADMIN_USERNAME;
    } else {
      process.env.APP_ADMIN_USERNAME = originalUsername;
    }

    if (originalPassword === undefined) {
      delete process.env.APP_ADMIN_PASSWORD;
    } else {
      process.env.APP_ADMIN_PASSWORD = originalPassword;
    }
  }
});

test("ensureConfiguredAdministrator upgrades an existing owner without changing its id", async () => {
  const originalUsername = process.env.APP_ADMIN_USERNAME;
  const originalPassword = process.env.APP_ADMIN_PASSWORD;
  process.env.APP_ADMIN_USERNAME = "configured-admin";
  process.env.APP_ADMIN_PASSWORD = "configured-password";

  try {
    const repository = createRepositoryFixture([
      {
        id: "owner-user",
        username: "owner",
        passwordHash: null,
        role: "USER",
        isActive: false,
      },
    ]);

    const user = await ensureConfiguredAdministrator(repository);

    assert.ok(user);
    assert.equal(user.id, "owner-user");
    assert.equal(user.username, "configured-admin");
    assert.equal(user.role, "ADMIN");
    assert.equal(user.isActive, true);
    assert.ok(user.passwordHash);
    assert.equal(
      await validateOwnerLogin("configured-admin", "configured-password", repository),
      user,
    );
  } finally {
    if (originalUsername === undefined) {
      delete process.env.APP_ADMIN_USERNAME;
    } else {
      process.env.APP_ADMIN_USERNAME = originalUsername;
    }

    if (originalPassword === undefined) {
      delete process.env.APP_ADMIN_PASSWORD;
    } else {
      process.env.APP_ADMIN_PASSWORD = originalPassword;
    }
  }
});

test("ensureConfiguredAdministrator does not reactivate an existing configured admin", async () => {
  const originalUsername = process.env.APP_ADMIN_USERNAME;
  const originalPassword = process.env.APP_ADMIN_PASSWORD;
  process.env.APP_ADMIN_USERNAME = "configured-admin";
  process.env.APP_ADMIN_PASSWORD = "configured-password";

  try {
    const existingHash = await hashPassword("existing-password");
    const repository = createRepositoryFixture([
      {
        id: "admin-user",
        username: "configured-admin",
        passwordHash: existingHash,
        role: "ADMIN",
        isActive: false,
      },
    ]);

    const user = await ensureConfiguredAdministrator(repository);

    assert.ok(user);
    assert.equal(user.id, "admin-user");
    assert.equal(user.isActive, false);
    assert.equal(user.passwordHash, existingHash);
    assert.equal(
      await validateOwnerLogin("configured-admin", "existing-password", repository),
      null,
    );
  } finally {
    if (originalUsername === undefined) {
      delete process.env.APP_ADMIN_USERNAME;
    } else {
      process.env.APP_ADMIN_USERNAME = originalUsername;
    }

    if (originalPassword === undefined) {
      delete process.env.APP_ADMIN_PASSWORD;
    } else {
      process.env.APP_ADMIN_PASSWORD = originalPassword;
    }
  }
});

test("validateOwnerLogin accepts the stored password hash once database-backed auth is active", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("new-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await validateOwnerLogin("owner", "new-password", repository);

  assert.ok(user);
  assert.equal(user.id, "user-1");
  assert.ok(user.lastLoginAt);
});

test("validateOwnerLogin rejects inactive users", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("new-password"),
      isActive: false,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  assert.equal(await validateOwnerLogin("owner", "new-password", repository), null);
});

test("validateOwnerLogin rejects fixed credentials in an empty database", async () => {
  const emptyRepository = createRepositoryFixture();

  assert.equal(
    await validateOwnerLogin("owner", "change-me", emptyRepository),
    null,
  );

});

test("validateOwnerLogin backfills an existing legacy owner with no password hash", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: null,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await validateOwnerLogin("owner", "change-me", repository);

  assert.ok(user);
  assert.ok(user.passwordHash);
  assert.equal(await verifyPassword("change-me", user.passwordHash), true);
});

test("createFirstAdministrator rejects setup after any user exists", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("new-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  await assert.rejects(
    () =>
      createFirstAdministrator(
        {
          username: "owner.next",
          password: "other-password",
          confirmPassword: "other-password",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Setup is already complete.",
  );
});

test("updateAccountCredentials updates the display name and password after validating the current password", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      displayName: "Owner",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await updateAccountCredentials(
    {
      userId: "user-1",
      currentPassword: "current-password",
      displayName: "  Family Manager  ",
      newPassword: "new-password",
      confirmNewPassword: "new-password",
    },
    repository,
  );

  assert.equal(user.displayName, "Family Manager");
  assert.equal(user.username, "owner");
  assert.ok(user.passwordHash);
  assert.equal(await verifyPassword("new-password", user.passwordHash), true);
});

test("updateAccountCredentials makes password-only changes reject the old password", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await updateAccountCredentials(
    {
      userId: "user-1",
      currentPassword: "current-password",
      newPassword: "new-password",
      confirmNewPassword: "new-password",
    },
    repository,
  );

  assert.equal(user.username, "owner");
  assert.ok(user.passwordHash);
  assert.equal(user.sessionVersion, 1);
  assert.equal(await verifyPassword("new-password", user.passwordHash), true);
  assert.equal(await verifyPassword("current-password", user.passwordHash), false);
  assert.ok(await validateOwnerLogin("owner", "new-password", repository));
  assert.equal(await validateOwnerLogin("owner", "current-password", repository), null);
});

test("validateSessionPayload exposes role and rejects inactive or stale sessions", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      role: "USER",
      sessionVersion: 2,
    },
    {
      id: "user-2",
      username: "inactive",
      passwordHash: await hashPassword("current-password"),
      isActive: false,
      sessionVersion: 0,
    },
  ]);

  assert.deepEqual(
    await validateSessionPayload(
      {
        sub: "user-1",
        username: "old-name",
        role: "USER",
        sessionVersion: 2,
      },
      repository,
    ),
    {
      sub: "user-1",
      displayName: null,
      username: "owner",
      role: "USER",
      sessionVersion: 2,
    },
  );

  assert.equal(
    await validateSessionPayload(
      {
        sub: "user-1",
        username: "owner",
        role: "USER",
        sessionVersion: 1,
      },
      repository,
    ),
    null,
  );
  assert.equal(
    await validateSessionPayload(
      {
        sub: "user-2",
        username: "inactive",
        role: "USER",
        sessionVersion: 0,
      },
      repository,
    ),
    null,
  );
});

test("updateAccountCredentials updates the display name without changing sign-in username", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      displayName: null,
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await updateAccountCredentials(
    {
      userId: "user-1",
      displayName: "Family Owner",
    },
    repository,
  );

  assert.equal(user.displayName, "Family Owner");
  assert.equal(user.username, "owner");
  assert.ok(await validateOwnerLogin("owner", "current-password", repository));
});

test("updateAccountCredentials backfills a legacy owner before saving changes", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: null,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await updateAccountCredentials(
    {
      userId: "user-1",
      currentPassword: "change-me",
      newPassword: "new-password",
      confirmNewPassword: "new-password",
    },
    repository,
  );

  assert.ok(user.passwordHash);
  assert.equal(await verifyPassword("new-password", user.passwordHash), true);
});

test("updateAccountCredentials rejects an incorrect current password", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  await assert.rejects(
    () =>
      updateAccountCredentials(
        {
          userId: "user-1",
          currentPassword: "wrong-password",
          newPassword: "new-password",
          confirmNewPassword: "new-password",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Current password is incorrect.",
  );
});

test("updateAccountCredentials rejects invalid display-name and password updates", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  await assert.rejects(
    () =>
      updateAccountCredentials(
        {
          userId: "user-1",
          displayName:
            "This display name is intentionally much longer than sixty four characters to trip validation.",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Display name must be 64 characters or fewer.",
  );

  await assert.rejects(
    () =>
      updateAccountCredentials(
        {
          userId: "user-1",
          currentPassword: "current-password",
          newPassword: "short",
          confirmNewPassword: "short",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "New password must be at least 8 characters.",
  );

  await assert.rejects(
    () =>
      updateAccountCredentials(
        {
          userId: "user-1",
          currentPassword: "current-password",
          newPassword: "new-password",
          confirmNewPassword: "other-password",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "New password and confirmation must match.",
  );

  await assert.rejects(
    () =>
      updateAccountCredentials(
        {
          userId: "user-1",
          displayName: "Family Owner",
          newPassword: "new-password",
          confirmNewPassword: "new-password",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Current password is required to change the password.",
  );
});

test("issueUserActionToken invalidates replaced tokens and validates only the newest token", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const firstToken = await issueUserActionToken(
    "user-1",
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );
  const secondToken = await issueUserActionToken(
    "user-1",
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:01:00Z"),
  );

  assert.equal(
    await validateUserActionToken(
      firstToken.token,
      "ACCOUNT_ACTIVATION",
      repository,
      new Date("2026-07-10T12:01:30Z"),
    ),
    null,
  );

  const validatedToken = await validateUserActionToken(
    secondToken.token,
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:01:30Z"),
  );

  assert.ok(validatedToken);
  assert.equal(validatedToken.userId, "user-1");
  assert.equal(validatedToken.tokenType, "ACCOUNT_ACTIVATION");
  assert.equal(validatedToken.expiresAt.toISOString(), "2026-07-10T12:06:00.000Z");
  assert.equal(validatedToken.consumedAt, null);
  assert.equal(validatedToken.invalidatedAt, null);
  assert.notEqual(firstToken.token, secondToken.token);
});

test("consumeUserActionToken makes a password reset token one-time use", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "PASSWORD_RESET",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  const consumedToken = await consumeUserActionToken(
    issuedToken.token,
    "PASSWORD_RESET",
    repository,
    new Date("2026-07-10T12:03:00Z"),
  );

  assert.ok(consumedToken);
  assert.equal(consumedToken.consumedAt?.toISOString(), "2026-07-10T12:03:00.000Z");
  assert.equal(
    await consumeUserActionToken(
      issuedToken.token,
      "PASSWORD_RESET",
      repository,
      new Date("2026-07-10T12:03:01Z"),
    ),
    null,
  );
});

test("validateUserActionToken rejects expired tokens and expireUserActionTokens invalidates them", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "TELEGRAM_BINDING",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  assert.equal(
    await validateUserActionToken(
      issuedToken.token,
      "TELEGRAM_BINDING",
      repository,
      new Date("2026-07-10T12:05:01Z"),
    ),
    null,
  );
  assert.equal(
    await expireUserActionTokens(repository, new Date("2026-07-10T12:05:01Z")),
    1,
  );
});

test("readSelfManagedPasswordLink returns activation metadata for valid tokens", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "family",
      isActive: false,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  const link = await readSelfManagedPasswordLink(
    issuedToken.token,
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:03:00Z"),
  );

  assert.deepEqual(link, {
    userId: "user-1",
    username: "family",
    tokenType: "ACCOUNT_ACTIVATION",
    expiresAt: new Date("2026-07-10T12:05:00.000Z"),
  });
});

test("readSelfManagedPasswordLink rejects activation tokens for active users", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "family",
      isActive: true,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  assert.equal(
    await readSelfManagedPasswordLink(
      issuedToken.token,
      "ACCOUNT_ACTIVATION",
      repository,
      new Date("2026-07-10T12:03:00Z"),
    ),
    null,
  );
});

test("completeSelfManagedPassword activates users and consumes one-time tokens", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "family",
      isActive: false,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  const updatedUser = await completeSelfManagedPassword(
    {
      token: issuedToken.token,
      password: "family-password",
      confirmPassword: "family-password",
      tokenType: "ACCOUNT_ACTIVATION",
    },
    repository,
    new Date("2026-07-10T12:03:00Z"),
  );

  assert.equal(updatedUser.isActive, true);
  assert.ok(updatedUser.passwordHash);
  assert.equal(await verifyPassword("family-password", updatedUser.passwordHash), true);
  assert.equal(
    await readSelfManagedPasswordLink(
      issuedToken.token,
      "ACCOUNT_ACTIVATION",
      repository,
      new Date("2026-07-10T12:03:01Z"),
    ),
    null,
  );
});

test("completeSelfManagedPassword invalidates older sessions for password resets", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "family",
      isActive: true,
      sessionVersion: 3,
      passwordHash: await hashPassword("old-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "PASSWORD_RESET",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  const updatedUser = await completeSelfManagedPassword(
    {
      token: issuedToken.token,
      password: "new-password",
      confirmPassword: "new-password",
      tokenType: "PASSWORD_RESET",
    },
    repository,
    new Date("2026-07-10T12:03:00Z"),
  );

  assert.equal(updatedUser.isActive, true);
  assert.equal(updatedUser.sessionVersion, 4);
  assert.ok(updatedUser.passwordHash);
  assert.equal(await verifyPassword("new-password", updatedUser.passwordHash), true);
});

test("completeSelfManagedPassword rejects reset links for inactive users", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "family",
      isActive: false,
      passwordHash: await hashPassword("old-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "PASSWORD_RESET",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  await assert.rejects(
    () =>
      completeSelfManagedPassword(
        {
          token: issuedToken.token,
          password: "new-password",
          confirmPassword: "new-password",
          tokenType: "PASSWORD_RESET",
        },
        repository,
        new Date("2026-07-10T12:03:00Z"),
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "That link is invalid or expired.",
  );
});

test("completeSelfManagedPassword rejects activation links for active users", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "family",
      isActive: true,
      passwordHash: await hashPassword("old-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const issuedToken = await issueUserActionToken(
    "user-1",
    "ACCOUNT_ACTIVATION",
    repository,
    new Date("2026-07-10T12:00:00Z"),
  );

  await assert.rejects(
    () =>
      completeSelfManagedPassword(
        {
          token: issuedToken.token,
          password: "new-password",
          confirmPassword: "new-password",
          tokenType: "ACCOUNT_ACTIVATION",
        },
        repository,
        new Date("2026-07-10T12:03:00Z"),
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "That link is invalid or expired.",
  );
});
