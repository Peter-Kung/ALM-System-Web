import assert from "node:assert/strict";
import test from "node:test";

import type { AuthRepository, AuthUser } from "@/modules/auth/repository";
import {
  hashPassword,
  validateOwnerLogin,
  verifyPassword,
} from "@/modules/auth/service";

function createRepositoryFixture(initialUsers: AuthUser[] = []): AuthRepository {
  const users = [...initialUsers];

  return {
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
