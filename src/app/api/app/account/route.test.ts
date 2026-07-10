import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { patchAccountHandler } from "@/app/api/app/account/handler";
import { RepositoryValidationError } from "@/lib/repository-utils";
import { patchAccountForUser } from "@/modules/auth";
import type { AuthRepository } from "@/modules/auth/repository";
import { hashPassword, verifyPassword } from "@/modules/auth/service";

test("patchAccountForUser clears the session after a successful credential update", async () => {
  let cleared = false;
  const currentPasswordHash = await hashPassword("current-password");
  const repository: AuthRepository = {
    async findById() {
      return {
        id: "user-1",
        username: "owner",
        passwordHash: currentPasswordHash,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      };
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
    async update(id, data) {
      return {
        id,
        username: typeof data.username === "string" ? data.username : "owner",
        passwordHash: typeof data.passwordHash === "string" ? data.passwordHash : null,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      };
    },
  };

  await patchAccountForUser(
    repository,
    {
      userId: "user-1",
      currentPassword: "current-password",
      username: "owner.next",
    },
    async () => {
      cleared = true;
    },
  );

  assert.equal(cleared, true);
});

test("patchAccountHandler clears the session after a successful password update", async () => {
  let cleared = false;
  let createdRepository = false;
  let savedPasswordHash: string | null = null;
  const currentPasswordHash = await hashPassword("current-password");
  const repository: AuthRepository = {
    async findById() {
      return {
        id: "user-1",
        username: "owner",
        passwordHash: currentPasswordHash,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      };
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
    async update(id, data) {
      savedPasswordHash =
        typeof data.passwordHash === "string" ? data.passwordHash : null;

      return {
        id,
        username: "owner",
        passwordHash: savedPasswordHash,
        createdAt: new Date("2026-07-01T00:00:00Z"),
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
          session: { sub: "user-1", username: "owner" },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(createdRepository, true);
  assert.equal(cleared, true);
  assert.ok(savedPasswordHash);
  assert.equal(await verifyPassword("new-password", savedPasswordHash), true);
});

test("patchAccountForUser does not clear the session when credential validation fails", async () => {
  let cleared = false;
  const currentPasswordHash = await hashPassword("current-password");
  const repository: AuthRepository = {
    async findById() {
      return {
        id: "user-1",
        username: "owner",
        passwordHash: currentPasswordHash,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      };
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
          username: "owner.next",
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
