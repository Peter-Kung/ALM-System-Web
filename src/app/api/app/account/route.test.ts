import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { patchAccountHandler } from "@/app/api/app/account/handler";
import { RepositoryValidationError } from "@/lib/repository-utils";
import { patchAccountForUser } from "@/modules/auth";
import type { AuthRepository, AuthUser } from "@/modules/auth/repository";
import { hashPassword, verifyPassword } from "@/modules/auth/service";

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    displayName: null,
    username: "owner",
    passwordHash: null,
    role: "ADMIN",
    isActive: true,
    sessionVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

test("patchAccountForUser keeps the session when only the display name changes", async () => {
  let cleared = false;
  const repository: AuthRepository = {
    async compareAndSetLoginState(id, _expected, data) {
      return this.update(id, data);
    },
    async findById() {
      return createAuthUser();
    },
    async findByUsername() {
      return null;
    },
    async findFirstUser() {
      return null;
    },
    async findFirstUserWithPasswordHash() {
      return null;
    },
    async create() {
      throw new Error("create should not run");
    },
    async createFirstAdministrator() {
      throw new Error("createFirstAdministrator should not run");
    },
    async update(id, data) {
      return createAuthUser({
        id,
        displayName:
          typeof data.displayName === "string" || data.displayName === null
            ? data.displayName
            : null,
      });
    },
  };

  const result = await patchAccountForUser(
    repository,
    {
      userId: "user-1",
      displayName: "Family Owner",
    },
    async () => {
      cleared = true;
    },
  );

  assert.equal(result.sessionCleared, false);
  assert.equal(result.user.displayName, "Family Owner");
  assert.equal(cleared, false);
});

test("patchAccountHandler clears the session after a successful password update", async () => {
  let cleared = false;
  let createdRepository = false;
  let savedPasswordHash: string | null = null;
  const currentPasswordHash = await hashPassword("current-password");
  const repository: AuthRepository = {
    async compareAndSetLoginState(id, _expected, data) {
      return this.update(id, data);
    },
    async findById() {
      return createAuthUser({
        passwordHash: currentPasswordHash,
      });
    },
    async findByUsername() {
      return null;
    },
    async findFirstUser() {
      return null;
    },
    async findFirstUserWithPasswordHash() {
      return null;
    },
    async create() {
      throw new Error("create should not run");
    },
    async createFirstAdministrator() {
      throw new Error("createFirstAdministrator should not run");
    },
    async update(id, data) {
      savedPasswordHash =
        typeof data.passwordHash === "string" ? data.passwordHash : null;

      return {
        ...createAuthUser({
          id,
          displayName: "Owner",
          username: "owner",
          passwordHash: savedPasswordHash,
          sessionVersion:
            typeof data.sessionVersion === "object" && data.sessionVersion
              ? 1
              : 0,
        }),
      };
    },
  };

  const response = await patchAccountHandler(
    new NextRequest("https://example.test/api/app/account", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "current-password",
        newPassword: "new-password",
        confirmNewPassword: "new-password",
      }),
    }),
    {
      async clearSession() {
        cleared = true;
      },
      createRepository() {
        createdRepository = true;
        return repository;
      },
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "user-1",
            displayName: null,
            username: "owner",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, signedOut: true });
  assert.equal(createdRepository, true);
  assert.equal(cleared, true);
  assert.ok(savedPasswordHash);
  assert.equal(await verifyPassword("new-password", savedPasswordHash), true);
});

test("patchAccountHandler keeps the session after a successful display-name update", async () => {
  let cleared = false;
  const repository: AuthRepository = {
    async compareAndSetLoginState(id, _expected, data) {
      return this.update(id, data);
    },
    async findById() {
      return createAuthUser();
    },
    async findByUsername() {
      return null;
    },
    async findFirstUser() {
      return null;
    },
    async findFirstUserWithPasswordHash() {
      return null;
    },
    async create() {
      throw new Error("create should not run");
    },
    async createFirstAdministrator() {
      throw new Error("createFirstAdministrator should not run");
    },
    async update(id, data) {
      return createAuthUser({
        id,
        displayName:
          typeof data.displayName === "string" || data.displayName === null
            ? data.displayName
            : null,
      });
    },
  };

  const response = await patchAccountHandler(
    new NextRequest("https://example.test/api/app/account", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: "Family Owner",
      }),
    }),
    {
      async clearSession() {
        cleared = true;
      },
      createRepository() {
        return repository;
      },
      async requireSession() {
        return {
          response: null,
          session: {
            sub: "user-1",
            displayName: null,
            username: "owner",
            role: "ADMIN",
            sessionVersion: 0,
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, signedOut: false });
  assert.equal(cleared, false);
});

test("patchAccountForUser does not clear the session when password validation fails", async () => {
  let cleared = false;
  const currentPasswordHash = await hashPassword("current-password");
  const repository: AuthRepository = {
    async compareAndSetLoginState(id, _expected, data) {
      return this.update(id, data);
    },
    async findById() {
      return createAuthUser({
        passwordHash: currentPasswordHash,
      });
    },
    async findByUsername() {
      return null;
    },
    async findFirstUser() {
      return null;
    },
    async findFirstUserWithPasswordHash() {
      return null;
    },
    async create() {
      throw new Error("create should not run");
    },
    async createFirstAdministrator() {
      throw new Error("createFirstAdministrator should not run");
    },
    async update() {
      throw new Error("update should not run");
    },
  };

  await assert.rejects(
    () =>
      patchAccountForUser(
        repository,
        {
          userId: "user-1",
          currentPassword: "wrong-password",
          newPassword: "new-password",
          confirmNewPassword: "new-password",
        },
        async () => {
          cleared = true;
        },
      ),
    (error: unknown) =>
      error instanceof RepositoryValidationError &&
      error.message === "Current password is incorrect.",
  );

  assert.equal(cleared, false);
});
