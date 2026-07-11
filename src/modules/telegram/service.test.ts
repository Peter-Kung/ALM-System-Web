import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { Prisma, UserActionTokenType } from "@prisma/client";

import {
  bindTelegramAccountByCode,
  handleTelegramBindingCodeMessage,
  sendTelegramPasswordResetLink,
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
  const users: StoredUser[] = [
    { id: "user-1", telegramChatId: null, username: "family" },
    { id: "user-2", telegramChatId: "existing-chat", username: "taken" },
  ];
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
        invalidatedAt:
          data.invalidatedAt instanceof Date ? data.invalidatedAt : null,
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
      return users.find((user) => user.id === id) ?? null;
    },
    async findByTelegramChatId(telegramChatId: string) {
      return users.find((user) => user.telegramChatId === telegramChatId) ?? null;
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
      const existingUser = users.find((entry) => entry.telegramChatId === telegramChatId);
      if (existingUser && existingUser.id !== userId) {
        const duplicateError = new Error("duplicate chat id") as Error & {
          code?: string;
        };
        duplicateError.code = "P2002";
        throw duplicateError;
      }

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

  async function issueToken(
    userId: string,
    tokenType: UserActionTokenType,
    expiresAt: Date,
    token: string,
  ) {
    return repository.createUserActionToken({
      expiresAt,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      tokenType,
      userId,
    });
  }

  return {
    actionTokens,
    issueToken,
    repository,
    users,
  };
}

function createTransportFixture() {
  const messages: Array<{ chatId: string; text: string }> = [];
  const transport: TelegramMessageTransport = {
    async sendMessage(chatId, text) {
      messages.push({ chatId, text });
    },
  };

  return { messages, transport };
}

test("handleTelegramBindingCodeMessage binds a valid code and sends an activation link", async () => {
  const now = new Date("2026-07-12T00:00:00Z");
  const { repository, issueToken, users } = createRepositoryFixture(now);
  const { messages, transport } = createTransportFixture();

  await issueToken(
    "user-1",
    "TELEGRAM_BINDING",
    new Date("2026-07-12T00:05:00Z"),
    "bind-code",
  );

  const result = await handleTelegramBindingCodeMessage(
    "bind-code",
    "chat-123",
    "http://10.0.0.5:3000",
    transport,
    repository,
    now,
  );

  assert.equal(result.status, "bound");
  assert.equal(users[0]?.telegramChatId, "chat-123");
  assert.equal(messages.length, 1);
  assert.match(messages[0]!.text, /http:\/\/10\.0\.0\.5:3000\/activate\?token=/);
  assert.match(messages[0]!.text, /expires in 5 minutes/);
});

test("bindTelegramAccountByCode rejects expired codes", async () => {
  const now = new Date("2026-07-12T00:10:00Z");
  const { repository, issueToken, users } = createRepositoryFixture(now);

  await issueToken(
    "user-1",
    "TELEGRAM_BINDING",
    new Date("2026-07-12T00:05:00Z"),
    "expired-code",
  );

  const result = await bindTelegramAccountByCode(
    "expired-code",
    "chat-123",
    repository,
    now,
  );

  assert.deepEqual(result, { status: "invalid_code" });
  assert.equal(users[0]?.telegramChatId, null);
});

test("handleTelegramBindingCodeMessage rejects a repeated binding code after it has been consumed", async () => {
  const now = new Date("2026-07-12T00:00:00Z");
  const { repository, issueToken } = createRepositoryFixture(now);
  const { messages, transport } = createTransportFixture();

  await issueToken(
    "user-1",
    "TELEGRAM_BINDING",
    new Date("2026-07-12T00:05:00Z"),
    "bind-code",
  );

  await bindTelegramAccountByCode("bind-code", "chat-123", repository, now);
  const repeatedAttempt = await handleTelegramBindingCodeMessage(
    "bind-code",
    "chat-123",
    "http://10.0.0.5:3000",
    transport,
    repository,
    now,
  );

  assert.equal(repeatedAttempt.status, "invalid_code");
  assert.equal(messages.length, 1);
  assert.match(messages[0]!.text, /invalid or expired/i);
});

test("sendTelegramPasswordResetLink sends the reset path", async () => {
  const { messages, transport } = createTransportFixture();

  const resetLink = await sendTelegramPasswordResetLink(
    "chat-123",
    "reset-token",
    "http://10.0.0.5:3000/base",
    transport,
  );

  assert.equal(resetLink, "http://10.0.0.5:3000/reset-password?token=reset-token");
  assert.equal(messages.length, 1);
  assert.match(messages[0]!.text, /reset-password\?token=reset-token/);
});
