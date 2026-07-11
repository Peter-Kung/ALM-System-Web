import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { Prisma, UserActionTokenType } from "@prisma/client";

import {
  createPendingActivationDeliveryStore,
  processTelegramBindingMessage,
  type TelegramMessageTransport,
  type TelegramOnboardingRepository,
} from "@/modules/telegram";

type StoredToken = {
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  invalidatedAt: Date | null;
  tokenHash: string;
  tokenType: UserActionTokenType;
  updatedAt: Date;
  userId: string;
};

type StoredUser = {
  id: string;
  telegramChatId: string | null;
  username: string;
};

function createRepositoryFixture(now = new Date("2026-07-12T00:00:00Z")) {
  const users: StoredUser[] = [{ id: "user-1", telegramChatId: null, username: "family" }];
  const actionTokens: StoredToken[] = [];
  let actionTokenCounter = 0;

  const repository: TelegramOnboardingRepository = {
    async createUserActionToken(data: Prisma.UserActionTokenUncheckedCreateInput) {
      actionTokenCounter += 1;
      const token = {
        consumedAt: data.consumedAt instanceof Date ? data.consumedAt : null,
        createdAt: now,
        expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
        id: `token-${actionTokenCounter}`,
        invalidatedAt: data.invalidatedAt instanceof Date ? data.invalidatedAt : null,
        tokenHash: data.tokenHash,
        tokenType: data.tokenType,
        updatedAt: now,
        userId: data.userId,
      };
      actionTokens.push(token);
      return token;
    },
    async expireUserActionTokens(expireAt: Date) {
      let count = 0;
      for (const token of actionTokens) {
        if (
          token.consumedAt === null &&
          token.invalidatedAt === null &&
          token.expiresAt.getTime() <= expireAt.getTime()
        ) {
          token.invalidatedAt = expireAt;
          token.updatedAt = expireAt;
          count += 1;
        }
      }

      return count;
    },
    async findById(id: string) {
      const user = users.find((entry) => entry.id === id);
      return user ? { id: user.id } : null;
    },
    async findBoundUserById(id: string) {
      return users.find((entry) => entry.id === id) ?? null;
    },
    async findByTelegramChatId(telegramChatId: string) {
      return users.find((entry) => entry.telegramChatId === telegramChatId) ?? null;
    },
    async findUserActionTokenByHash(tokenHash: string, tokenType: UserActionTokenType) {
      return (
        actionTokens.find(
          (token) => token.tokenHash === tokenHash && token.tokenType === tokenType,
        ) ?? null
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
    async updateTelegramChatId(userId: string, telegramChatId: string) {
      const user = users.find((entry) => entry.id === userId);
      if (!user) {
        throw new Error(`missing user ${userId}`);
      }

      user.telegramChatId = telegramChatId;
      return user;
    },
    async withTransaction(operation) {
      return operation(this);
    },
  };

  return {
    async issueBindingCode(code: string) {
      await repository.createUserActionToken({
        expiresAt: new Date("2026-07-12T00:05:00Z"),
        tokenHash: createHash("sha256").update(code).digest("hex"),
        tokenType: "TELEGRAM_BINDING",
        userId: "user-1",
      });
    },
    repository,
  };
}

test("processTelegramBindingMessage retries delivery with the same activation token after a send failure", async () => {
  const now = new Date("2026-07-12T00:00:00Z");
  const { repository, issueBindingCode } = createRepositoryFixture(now);
  await issueBindingCode("bind-code");

  const sentMessages: string[] = [];
  let sendAttempts = 0;
  const transport: TelegramMessageTransport = {
    async sendMessage(_chatId, text) {
      sendAttempts += 1;
      if (sendAttempts === 1) {
        throw new Error("temporary telegram failure");
      }

      sentMessages.push(text);
    },
  };

  const pendingDeliveries = createPendingActivationDeliveryStore();

  await assert.rejects(
    processTelegramBindingMessage(
      "bind-code",
      "chat-123",
      "http://10.0.0.5:3000",
      transport,
      repository,
      pendingDeliveries,
      now,
    ),
    /temporary telegram failure/,
  );
  assert.ok(await pendingDeliveries.get("chat-123:bind-code"));

  await processTelegramBindingMessage(
    "bind-code",
    "chat-123",
    "http://10.0.0.5:3000",
    transport,
    repository,
    pendingDeliveries,
    now,
  );

  assert.equal(await pendingDeliveries.get("chat-123:bind-code"), null);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!, /activate\?token=/);
});
