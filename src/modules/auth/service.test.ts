import assert from "node:assert/strict";
import test from "node:test";

import type { AuthRepository, AuthUser } from "@/modules/auth/repository";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createFirstAdministrator,
  ensureConfiguredAdministrator,
  hashPassword,
  isBootstrapRequired,
  updateAccountCredentials,
  validateOwnerLogin,
  validateSessionPayload,
  verifyPassword,
} from "@/modules/auth/service";

function createAuthUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: "user-1",
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

function createRepositoryFixture(initialUsers: Partial<AuthUser>[] = []): AuthRepository {
  const users = initialUsers.map((user, index) =>
    createAuthUser({
      id: `user-${index + 1}`,
      createdAt: new Date(`2026-07-0${index + 1}T00:00:00Z`),
      ...user,
    }),
  );

  return {
    async findById(id) {
      return users.find((user) => user.id === id) ?? null;
    },
    async findByUsername(username) {
      return users.find((user) => user.username === username) ?? null;
    },
    async findFirstUser() {
      return users[0] ?? null;
    },
    async findFirstUserWithPasswordHash() {
      return users.find((user) => user.passwordHash) ?? null;
    },
    async create(data) {
      const user = createAuthUser({
        id: `user-${users.length + 1}`,
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
    async createFirstAdministrator(data) {
      const user = createAuthUser({
        id: `user-${users.length + 1}`,
        username: data.username,
        passwordHash: data.passwordHash,
        createdAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
      });
      users.push(user);
      return user;
    },
    async update(id, data) {
      const user = users.find((entry) => entry.id === id);
      if (!user) {
        throw new Error(`missing user ${id}`);
      }

      if (typeof data.username === "string") {
        user.username = data.username;
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

test("updateAccountCredentials updates the username and password after validating the current password", async () => {
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
      username: " owner.next ",
      newPassword: "new-password",
      confirmNewPassword: "new-password",
    },
    repository,
  );

  assert.equal(user.username, "owner.next");
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

test("updateAccountCredentials makes username-only changes require the new username for sign-in", async () => {
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
      username: "owner.next",
    },
    repository,
  );

  assert.equal(user.username, "owner.next");
  assert.ok(await validateOwnerLogin("owner.next", "current-password", repository));
  assert.equal(await validateOwnerLogin("owner", "current-password", repository), null);
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
          username: "owner.next",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Current password is incorrect.",
  );
});

test("updateAccountCredentials rejects duplicate usernames", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: await hashPassword("current-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
    {
      id: "user-2",
      username: "taken-name",
      passwordHash: await hashPassword("different-password"),
      createdAt: new Date("2026-07-02T00:00:00Z"),
    },
  ]);

  await assert.rejects(
    () =>
      updateAccountCredentials(
        {
          userId: "user-1",
          currentPassword: "current-password",
          username: "taken-name",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "That username is already in use.",
  );
});

test("updateAccountCredentials rejects invalid username and password updates", async () => {
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
          currentPassword: "current-password",
          username: "a",
        },
        repository,
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message ===
        "Username must be 3 to 32 characters and use only letters, numbers, '.', '_', and '-'.",
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
});
