import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { activateAccountHandler } from "@/app/api/auth/activate/handler";
import type { AuthRepository, UserActionTokenRepository } from "@/modules/auth";

function createRepositoryFixture() {
  const user: {
    createdAt: Date;
    id: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    passwordHash: string | null;
    role: "USER";
    sessionVersion: number;
    username: string;
  } = {
    id: "user-1",
    username: "family",
    passwordHash: null,
    role: "USER" as const,
    isActive: false,
    sessionVersion: 0,
    lastLoginAt: null,
    createdAt: new Date("2026-07-12T00:00:00Z"),
  };
  const tokens = [
    {
      id: "token-1",
      userId: user.id,
      tokenType: "ACCOUNT_ACTIVATION" as const,
      tokenHash: createHash("sha256").update("activate-token").digest("hex"),
      expiresAt: new Date("2026-07-12T00:05:00Z"),
      consumedAt: null as Date | null,
      invalidatedAt: null as Date | null,
      createdAt: new Date("2026-07-12T00:00:00Z"),
      updatedAt: new Date("2026-07-12T00:00:00Z"),
    },
  ];

  const repository: AuthRepository & UserActionTokenRepository = {
    async create(data: Prisma.UserCreateInput) {
      throw new Error(`unexpected create: ${JSON.stringify(data)}`);
    },
    async createFirstAdministrator(data: { passwordHash: string; username: string }) {
      throw new Error(`unexpected createFirstAdministrator: ${JSON.stringify(data)}`);
    },
    async createUserActionToken(data: Prisma.UserActionTokenUncheckedCreateInput) {
      throw new Error(`unexpected createUserActionToken: ${JSON.stringify(data)}`);
    },
    async expireUserActionTokens() {
      return 0;
    },
    async findById(id: string) {
      return id === user.id ? user : null;
    },
    async findByUsername() {
      return null;
    },
    async findFirstUser() {
      return user;
    },
    async findFirstUserWithPasswordHash() {
      return null;
    },
    async findUserActionTokenByHash(tokenHash: string) {
      return tokens.find((token) => token.tokenHash === tokenHash) ?? null;
    },
    async invalidateActiveUserActionTokens() {
      return 0;
    },
    async markUserActionTokenConsumed(tokenId: string, consumedAt: Date) {
      const token = tokens.find((entry) => entry.id === tokenId);
      if (!token) {
        return null;
      }

      token.consumedAt = consumedAt;
      token.updatedAt = consumedAt;
      return token;
    },
    async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
      assert.equal(id, user.id);
      assert.equal(data.isActive, true);
      assert.equal(typeof data.passwordHash, "string");
      user.isActive = true;
      user.passwordHash = data.passwordHash as string;
      return user;
    },
    async withTransaction<T>(
      operation: (repository: AuthRepository & UserActionTokenRepository) => Promise<T>,
    ) {
      return operation(this);
    },
  };

  return { repository, user };
}

test("activateAccountHandler activates the account and redirects to login", async () => {
  const { repository, user } = createRepositoryFixture();
  const response = await activateAccountHandler(
    new NextRequest("https://example.test/api/auth/activate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        token: "activate-token",
        password: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    }),
    {
      createRepository: () => repository,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, next: "/login" });
  assert.equal(user.isActive, true);
  assert.equal(typeof user.passwordHash, "string");
});
