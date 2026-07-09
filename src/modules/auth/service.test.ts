import assert from "node:assert/strict";
import test from "node:test";

import type { AuthRepository, AuthUser } from "@/modules/auth/repository";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  hashPassword,
  updateAccountCredentials,
  validateOwnerLogin,
  verifyPassword,
} from "@/modules/auth/service";

function createRepositoryFixture(initialUsers: AuthUser[] = []): AuthRepository {
  const users = [...initialUsers];

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
      const user = {
        id: `user-${users.length + 1}`,
        username: data.username,
        passwordHash: data.passwordHash ?? null,
        createdAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
      };
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

      return user;
    },
  };
}

test("validateOwnerLogin creates the owner with a password hash in a fresh environment", async () => {
  const repository = createRepositoryFixture();

  const user = await validateOwnerLogin("owner", "change-me", repository);

  assert.ok(user);
  assert.equal(user.username, "owner");
  assert.ok(user.passwordHash);
  assert.equal(await verifyPassword("change-me", user.passwordHash), true);
});

test("validateOwnerLogin backfills the legacy owner account when the user has no password hash", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "legacy-owner",
      passwordHash: null,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await validateOwnerLogin("owner", "change-me", repository);

  assert.ok(user);
  assert.equal(user.id, "user-1");
  assert.equal(user.username, "owner");
  assert.ok(user.passwordHash);
  assert.equal(await verifyPassword("change-me", user.passwordHash), true);
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
});

test("validateOwnerLogin rejects legacy environment credentials after a password hash already exists", async () => {
  const repository = createRepositoryFixture([
    {
      id: "user-1",
      username: "renamed-owner",
      passwordHash: await hashPassword("new-password"),
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const user = await validateOwnerLogin("owner", "change-me", repository);

  assert.equal(user, null);
});

test("validateOwnerLogin recovers when a concurrent bootstrap creates the owner first", async () => {
  const passwordHash = await hashPassword("change-me");
  const users: AuthUser[] = [];
  const repository: AuthRepository = {
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
    async create() {
      users.push({
        id: "user-1",
        username: "owner",
        passwordHash,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      });

      throw new Error("simulated concurrent create");
    },
    async update() {
      throw new Error("update should not run");
    },
  };

  const user = await validateOwnerLogin("owner", "change-me", repository);

  assert.ok(user);
  assert.equal(user.id, "user-1");
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

test("updateAccountCredentials backfills the legacy password hash before saving changes", async () => {
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
