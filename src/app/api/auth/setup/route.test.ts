import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { setupHandler } from "@/app/api/auth/setup/handler";
import type { AuthRepository, AuthUser } from "@/modules/auth/repository";
import { verifyPassword } from "@/modules/auth/service";

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

function createRepositoryFixture(initialUsers: Partial<AuthUser>[] = []) {
  const users = initialUsers.map((user, index) =>
    createAuthUser({ id: `user-${index + 1}`, ...user }),
  );
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
    async create(data) {
      const user = createAuthUser({
        id: `user-${users.length + 1}`,
        username: data.username,
        passwordHash: data.passwordHash ?? null,
      });
      users.push(user);
      return user;
    },
    async createFirstAdministrator(data) {
      const user = createAuthUser({
        id: `user-${users.length + 1}`,
        username: data.username,
        passwordHash: data.passwordHash,
      });
      users.push(user);
      return user;
    },
    async update() {
      throw new Error("update should not run");
    },
  };

  return { repository, users };
}

test("setupHandler creates the first administrator and signs in", async () => {
  let sessionToken: string | null = null;
  const { repository, users } = createRepositoryFixture();

  const response = await setupHandler(
    new NextRequest("https://example.test/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        username: " owner ",
        setupToken: "setup-token",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    }),
    {
      async createSessionToken(payload) {
        return `token:${payload.sub}:${payload.username}:${payload.role}:${payload.sessionVersion}`;
      },
      createRepository() {
        return repository;
      },
      async setSession(token) {
        sessionToken = token;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, next: "/dashboard" });
  assert.equal(users.length, 1);
  assert.equal(users[0].username, "owner");
  assert.ok(users[0].passwordHash);
  assert.equal(await verifyPassword("new-password", users[0].passwordHash), true);
  assert.ok(sessionToken);
});

test("setupHandler rejects setup after the first user exists", async () => {
  let setSessionCalled = false;
  const { repository } = createRepositoryFixture([
    {
      id: "user-1",
      username: "owner",
      passwordHash: "hash",
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);

  const response = await setupHandler(
    new NextRequest("https://example.test/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        username: "owner.next",
        setupToken: "setup-token",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    }),
    {
      async createSessionToken() {
        throw new Error("token should not be created");
      },
      createRepository() {
        return repository;
      },
      async setSession() {
        setSessionCalled = true;
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Setup is already complete." });
  assert.equal(setSessionCalled, false);
});

test("setupHandler rejects cross-origin and non-JSON setup requests", async () => {
  let createRepositoryCalled = false;
  const dependencies = {
    async createSessionToken() {
      throw new Error("token should not be created");
    },
    createRepository() {
      createRepositoryCalled = true;
      return createRepositoryFixture().repository;
    },
    async setSession() {
      throw new Error("session should not be set");
    },
  };

  const crossOriginResponse = await setupHandler(
    new NextRequest("https://example.test/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.test",
      },
      body: JSON.stringify({
        username: "owner",
        setupToken: "setup-token",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    }),
    dependencies,
  );

  assert.equal(crossOriginResponse.status, 403);
  assert.deepEqual(await crossOriginResponse.json(), {
    error: "Invalid setup request.",
  });

  const nonJsonResponse = await setupHandler(
    new NextRequest("https://example.test/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        username: "owner",
        setupToken: "setup-token",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    }),
    dependencies,
  );

  assert.equal(nonJsonResponse.status, 415);
  assert.deepEqual(await nonJsonResponse.json(), {
    error: "Setup requests must use JSON.",
  });
  assert.equal(createRepositoryCalled, false);
});

test("setupHandler rejects invalid setup tokens", async () => {
  let createRepositoryCalled = false;

  const response = await setupHandler(
    new NextRequest("https://example.test/api/auth/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        username: "owner",
        setupToken: "wrong-token",
        password: "new-password",
        confirmPassword: "new-password",
      }),
    }),
    {
      async createSessionToken() {
        throw new Error("token should not be created");
      },
      createRepository() {
        createRepositoryCalled = true;
        return createRepositoryFixture().repository;
      },
      async setSession() {
        throw new Error("session should not be set");
      },
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Invalid setup token." });
  assert.equal(createRepositoryCalled, false);
});
