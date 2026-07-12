import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma, UserActionTokenType } from "@prisma/client";

import { RepositoryValidationError } from "@/lib/repository-utils";
import type { ManagedUser, UserManagementRepository } from "@/modules/users";
import {
  createManagedUser,
  listManagedUsers,
  requestManagedUserActivation,
  requestManagedUserPasswordReset,
  requestManagedUserTelegramBindingCode,
  updateManagedUser,
} from "@/modules/users/service";

function createManagedUserFixture(overrides: Partial<ManagedUser>): ManagedUser {
  return {
    id: "user-1",
    username: "owner",
    displayName: null,
    role: "ADMIN",
    isActive: true,
    sessionVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    telegramUsername: null,
    telegramBoundAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
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
  initialUsers: Partial<ManagedUser>[] = [],
): UserManagementRepository {
  const users = initialUsers.map((user, index) =>
    createManagedUserFixture({
      id: `user-${index + 1}`,
      createdAt: new Date(`2026-07-0${index + 1}T00:00:00Z`),
      updatedAt: new Date(`2026-07-0${index + 1}T00:00:00Z`),
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
    async countActiveAdmins() {
      return users.filter((user) => user.role === "ADMIN" && user.isActive).length;
    },
    async create(data: {
      displayName?: string | null;
      isActive: boolean;
      role: "ADMIN" | "USER";
      username: string;
    }) {
      const user = createManagedUserFixture({
        id: `user-${users.length + 1}`,
        username: data.username,
        displayName: data.displayName,
        role: data.role,
        isActive: data.isActive,
        createdAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
        updatedAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
      });
      users.push(user);
      return user;
    },
    async createUserActionToken(data: Prisma.UserActionTokenUncheckedCreateInput) {
      tokenCounter += 1;
      const createdAt = new Date("2026-07-11T00:00:00Z");
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
    async findById(id: string) {
      return users.find((user) => user.id === id) ?? null;
    },
    async findByUsername(username: string) {
      return users.find((user) => user.username === username) ?? null;
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
    async list() {
      return [...users].sort((left, right) =>
        `${left.role}:${left.username}`.localeCompare(
          `${right.role}:${right.username}`,
        ),
      );
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
    async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
      const user = users.find((entry) => entry.id === id);
      if (!user) {
        throw new Error(`missing user ${id}`);
      }

      if (data.role === "ADMIN" || data.role === "USER") {
        user.role = data.role;
      }

      if (typeof data.isActive === "boolean") {
        user.isActive = data.isActive;
      }

      if (typeof data.displayName === "string" || data.displayName === null) {
        user.displayName = data.displayName;
      }

      if (typeof data.telegramUsername === "string" || data.telegramUsername === null) {
        user.telegramUsername = data.telegramUsername;
      }

      if (
        typeof data.telegramBoundAt === "object" &&
        data.telegramBoundAt instanceof Date
      ) {
        user.telegramBoundAt = data.telegramBoundAt;
      }

      if (
        typeof data.sessionVersion === "object" &&
        data.sessionVersion &&
        "increment" in data.sessionVersion &&
        typeof data.sessionVersion.increment === "number"
      ) {
        user.sessionVersion += data.sessionVersion.increment;
      }

      user.updatedAt = new Date("2026-07-09T00:00:00Z");
      return user;
    },
    async withTransaction(operation) {
      return operation(this);
    },
  };
}

test("listManagedUsers returns admin-safe user fields", async () => {
  const repository = createRepositoryFixture([
    {
      id: "admin-user",
      username: "admin",
      role: "ADMIN",
      lastLoginAt: new Date("2026-07-08T00:00:00Z"),
    },
  ]);

  assert.deepEqual(await listManagedUsers(repository), [
    {
      id: "admin-user",
      username: "admin",
      displayName: null,
      role: "ADMIN",
      isActive: true,
      sessionVersion: 0,
      loginLockout: {
        failedAttempts: 0,
        lockedUntil: null,
      },
      lastLoginAt: "2026-07-08T00:00:00.000Z",
      telegramBinding: {
        state: "UNBOUND",
        telegramUsername: null,
        boundAt: null,
      },
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ]);
});

test("listManagedUsers exposes current login lockout state to admins", async () => {
  const repository = createRepositoryFixture([
    {
      id: "family-user",
      username: "family",
      role: "USER",
      failedLoginAttempts: 5,
      lockedUntil: new Date("2026-07-12T00:10:00Z"),
    },
  ]);

  assert.deepEqual(await listManagedUsers(repository), [
    {
      id: "family-user",
      username: "family",
      displayName: null,
      role: "USER",
      isActive: true,
      sessionVersion: 0,
      loginLockout: {
        failedAttempts: 5,
        lockedUntil: "2026-07-12T00:10:00.000Z",
      },
      lastLoginAt: null,
      telegramBinding: {
        state: "UNBOUND",
        telegramUsername: null,
        boundAt: null,
      },
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ]);
});

test("createManagedUser creates a user without a password", async () => {
  const repository = createRepositoryFixture();

  const user = await createManagedUser(
    {
      username: " family.user ",
      role: "USER",
      isActive: false,
    },
    repository,
  );

  assert.equal(user.username, "family.user");
  assert.equal(user.displayName, null);
  assert.equal(user.role, "USER");
  assert.equal(user.isActive, false);
});

test("createManagedUser stores a trimmed display name", async () => {
  const repository = createRepositoryFixture();

  const user = await createManagedUser(
    {
      username: "family.user",
      displayName: "  Family Member  ",
      role: "USER",
      isActive: true,
    },
    repository,
  );

  assert.equal(user.displayName, "Family Member");
});

test("createManagedUser rejects duplicate usernames", async () => {
  const repository = createRepositoryFixture([{ username: "family.user" }]);

  await assert.rejects(
    () =>
      createManagedUser(
        {
          username: "family.user",
          role: "USER",
          isActive: true,
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "That username is already in use.",
  );
});

test("updateManagedUser protects the last active admin from deactivation", async () => {
  const repository = createRepositoryFixture([
    {
      id: "admin-user",
      username: "admin",
      role: "ADMIN",
      isActive: true,
    },
  ]);

  await assert.rejects(
    () => updateManagedUser("admin-user", { isActive: false }, repository),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "At least one active admin is required.",
  );
});

test("updateManagedUser protects the last active admin from downgrade", async () => {
  const repository = createRepositoryFixture([
    {
      id: "admin-user",
      username: "admin",
      role: "ADMIN",
      isActive: true,
    },
  ]);

  await assert.rejects(
    () => updateManagedUser("admin-user", { role: "USER" }, repository),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "At least one active admin is required.",
  );
});

test("updateManagedUser increments session version when deactivating a user", async () => {
  const repository = createRepositoryFixture([
    {
      id: "admin-user",
      username: "admin",
      role: "ADMIN",
      isActive: true,
    },
    {
      id: "family-user",
      username: "family",
      role: "USER",
      isActive: true,
      sessionVersion: 3,
    },
  ]);

  const user = await updateManagedUser(
    "family-user",
    { isActive: false },
    repository,
  );

  assert.equal(user.isActive, false);
  assert.equal(user.sessionVersion, 4);
});

test("updateManagedUser uses one repository transaction for admin protection and update", async () => {
  let transactionCount = 0;
  const repository = createRepositoryFixture([
    {
      id: "admin-user",
      username: "admin",
      role: "ADMIN",
      isActive: true,
    },
    {
      id: "second-admin",
      username: "admin2",
      role: "ADMIN",
      isActive: true,
    },
  ]);
  repository.withTransaction = async <T,>(
    operation: (repository: UserManagementRepository) => Promise<T>,
  ) => {
    transactionCount += 1;
    return operation(repository);
  };

  await updateManagedUser("second-admin", { role: "USER" }, repository);

  assert.equal(transactionCount, 1);
});

test("requestManagedUserPasswordReset does not return a password", async () => {
  const repository = createRepositoryFixture([
    {
      id: "family-user",
      username: "family",
      role: "USER",
      telegramBoundAt: new Date("2026-07-11T00:00:00Z"),
      telegramUsername: "family_member",
    },
  ]);

  assert.deepEqual(
    await requestManagedUserPasswordReset(
      "family-user",
      repository,
      new Date("2026-07-11T00:00:00Z"),
    ),
    {
      user: {
        id: "family-user",
        username: "family",
        displayName: null,
        role: "USER",
        isActive: true,
        sessionVersion: 0,
        loginLockout: {
          failedAttempts: 0,
          lockedUntil: null,
        },
        lastLoginAt: null,
        telegramBinding: {
          state: "BOUND",
          telegramUsername: "family_member",
          boundAt: "2026-07-11T00:00:00.000Z",
        },
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      delivery: "pending_self_managed_onboarding",
      expiresAt: "2026-07-11T00:05:00.000Z",
      tokenType: "PASSWORD_RESET",
    },
  );
});

test("requestManagedUserActivation returns activation metadata without a usable token", async () => {
  const repository = createRepositoryFixture([
    {
      id: "family-user",
      username: "family",
      role: "USER",
      isActive: false,
      telegramBoundAt: new Date("2026-07-11T00:00:00Z"),
      telegramUsername: "family_member",
    },
  ]);

  assert.deepEqual(
    await requestManagedUserActivation(
      "family-user",
      repository,
      new Date("2026-07-11T00:00:00Z"),
    ),
    {
      user: {
        id: "family-user",
        username: "family",
        displayName: null,
        role: "USER",
        isActive: false,
        sessionVersion: 0,
        loginLockout: {
          failedAttempts: 0,
          lockedUntil: null,
        },
        lastLoginAt: null,
        telegramBinding: {
          state: "BOUND",
          telegramUsername: "family_member",
          boundAt: "2026-07-11T00:00:00.000Z",
        },
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      delivery: "pending_self_managed_onboarding",
      expiresAt: "2026-07-11T00:05:00.000Z",
      tokenType: "ACCOUNT_ACTIVATION",
    },
  );
});

test("requestManagedUserTelegramBindingCode returns a short-lived code", async () => {
  const repository = createRepositoryFixture([
    {
      id: "family-user",
      username: "family",
      role: "USER",
    },
  ]);

  const response = await requestManagedUserTelegramBindingCode(
    "family-user",
    repository,
    new Date("2026-07-11T00:00:00Z"),
  );

  assert.equal(response.user.username, "family");
  assert.equal(response.delivery, "share_with_user");
  assert.equal(response.tokenType, "TELEGRAM_BINDING");
  assert.equal(typeof response.bindingCode, "string");
  assert.equal(response.expiresAt, "2026-07-11T00:05:00.000Z");
});

test("requestManagedUserActivation rejects already active users", async () => {
  const repository = createRepositoryFixture([
    {
      id: "family-user",
      username: "family",
      role: "USER",
      isActive: true,
    },
  ]);

  await assert.rejects(
    () =>
      requestManagedUserActivation(
        "family-user",
        repository,
        new Date("2026-07-11T00:00:00Z"),
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Activation links are only available for inactive users.",
  );
});
