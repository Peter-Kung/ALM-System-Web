import assert from "node:assert/strict";
import test from "node:test";

import { RepositoryValidationError } from "@/lib/repository-utils";
import type { ManagedUser, UserManagementRepository } from "@/modules/users";
import {
  createManagedUser,
  listManagedUsers,
  requestManagedUserPasswordReset,
  updateManagedUser,
} from "@/modules/users/service";

function createManagedUserFixture(overrides: Partial<ManagedUser>): ManagedUser {
  return {
    id: "user-1",
    username: "owner",
    role: "ADMIN",
    isActive: true,
    sessionVersion: 0,
    lastLoginAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
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

  return {
    async countActiveAdmins() {
      return users.filter((user) => user.role === "ADMIN" && user.isActive).length;
    },
    async create(data) {
      const user = createManagedUserFixture({
        id: `user-${users.length + 1}`,
        username: data.username,
        role: data.role,
        isActive: data.isActive,
        createdAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
        updatedAt: new Date(`2026-07-0${users.length + 1}T00:00:00Z`),
      });
      users.push(user);
      return user;
    },
    async findById(id) {
      return users.find((user) => user.id === id) ?? null;
    },
    async findByUsername(username) {
      return users.find((user) => user.username === username) ?? null;
    },
    async list() {
      return [...users].sort((left, right) =>
        `${left.role}:${left.username}`.localeCompare(
          `${right.role}:${right.username}`,
        ),
      );
    },
    async update(id, data) {
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
      role: "ADMIN",
      isActive: true,
      sessionVersion: 0,
      lastLoginAt: "2026-07-08T00:00:00.000Z",
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
  assert.equal(user.role, "USER");
  assert.equal(user.isActive, false);
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
    },
  ]);

  assert.deepEqual(await requestManagedUserPasswordReset("family-user", repository), {
    user: {
      id: "family-user",
      username: "family",
      role: "USER",
      isActive: true,
      sessionVersion: 0,
      lastLoginAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    delivery: "pending_self_managed_onboarding",
  });
});
