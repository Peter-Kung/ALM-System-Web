import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import {
  createUserHandler,
  listUsersHandler,
} from "@/app/api/admin/users/handler";
import { updateUserHandler } from "@/app/api/admin/users/[userId]/handler";
import { requestUserActivationHandler } from "@/app/api/admin/users/[userId]/activation-request/handler";
import { requestUserPasswordResetHandler } from "@/app/api/admin/users/[userId]/password-reset-request/handler";
import type { ManagedUser, UserManagementRepository } from "@/modules/users";

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

function createRepositoryFixture(): UserManagementRepository {
  const users: ManagedUser[] = [
    createManagedUserFixture({
      id: "admin-user",
      username: "admin",
      role: "ADMIN",
    }),
  ];

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
      return users;
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

      return user;
    },
    async withTransaction(operation) {
      return operation(this);
    },
  };
}

test("listUsersHandler rejects non-admin sessions", async () => {
  const response = await listUsersHandler({
    createRepository: createRepositoryFixture,
    async requireSession() {
      return {
        response: null,
        session: {
          sub: "user-1",
          username: "family",
          role: "USER",
          sessionVersion: 0,
        },
      };
    },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
});

test("createUserHandler rejects admin-set passwords", async () => {
  const response = await createUserHandler(
    new NextRequest("https://example.test/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        username: "family",
        role: "USER",
        isActive: true,
        temporaryPassword: "not-allowed",
      }),
    }),
    {
      createRepository: createRepositoryFixture,
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "admin-user",
            username: "admin",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Admins cannot set another user's password.",
  });
});

test("createUserHandler creates users for admin sessions", async () => {
  const response = await createUserHandler(
    new NextRequest("https://example.test/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        username: "family",
        role: "USER",
        isActive: false,
      }),
    }),
    {
      createRepository: createRepositoryFixture,
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "admin-user",
            username: "admin",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.equal((await response.json()).user.username, "family");
});

test("updateUserHandler rejects admin-set passwords", async () => {
  const response = await updateUserHandler(
    new NextRequest("https://example.test/api/admin/users/family-user", {
      method: "PATCH",
      body: JSON.stringify({
        isActive: false,
        password: "not-allowed",
      }),
    }),
    "family-user",
    {
      createRepository: createRepositoryFixture,
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "admin-user",
            username: "admin",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Admins cannot set another user's password.",
  });
});

test("updateUserHandler rejects non-admin sessions", async () => {
  const response = await updateUserHandler(
    new NextRequest("https://example.test/api/admin/users/family-user", {
      method: "PATCH",
      body: JSON.stringify({
        isActive: false,
      }),
    }),
    "family-user",
    {
      createRepository: createRepositoryFixture,
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "family-user",
            username: "family",
            role: "USER",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
});

test("updateUserHandler updates active status and increments session version", async () => {
  const repository = createRepositoryFixture();
  await repository.create({
    username: "family",
    role: "USER",
    isActive: true,
  });

  const response = await updateUserHandler(
    new NextRequest("https://example.test/api/admin/users/user-2", {
      method: "PATCH",
      body: JSON.stringify({
        isActive: false,
      }),
    }),
    "user-2",
    {
      createRepository: () => repository,
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "admin-user",
            username: "admin",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.isActive, false);
  assert.equal(body.user.sessionVersion, 1);
});

test("requestUserActivationHandler rejects non-admin sessions", async () => {
  const response = await requestUserActivationHandler("family-user", {
    createRepository: createRepositoryFixture,
    async requireSession() {
      return {
        response: null,
        session: {
          sub: "family-user",
          username: "family",
          role: "USER",
          sessionVersion: 0,
        },
      };
    },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
});

test("requestUserPasswordResetHandler returns no usable password", async () => {
  const repository = createRepositoryFixture();
  await repository.create({
    username: "family",
    role: "USER",
    isActive: true,
  });

  const response = await requestUserPasswordResetHandler("user-2", {
    createRepository: () => repository,
    async requireSession() {
      return {
        response: null,
        session: {
          sub: "admin-user",
          username: "admin",
          role: "ADMIN",
          sessionVersion: 0,
        },
      };
    },
  });

  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.delivery, "pending_self_managed_onboarding");
  assert.equal(body.user.username, "family");
  assert.equal("password" in body, false);
  assert.equal("temporaryPassword" in body, false);
});
