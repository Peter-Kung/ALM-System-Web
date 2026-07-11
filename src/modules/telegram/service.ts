import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  consumeUserActionToken,
  createAuthRepository,
  issueUserActionToken,
  type UserActionTokenRepository,
} from "@/modules/auth";

type TelegramBoundUser = {
  id: string;
  telegramChatId: string | null;
  username: string;
};

type StoredTelegramActionToken = {
  consumedAt: Date | null;
  expiresAt: Date;
  id: string;
  invalidatedAt: Date | null;
  userId: string;
};

export type TelegramOnboardingRepository = Omit<
  UserActionTokenRepository,
  "withTransaction"
> & {
  findBoundUserById(id: string): Promise<TelegramBoundUser | null>;
  findByTelegramChatId(telegramChatId: string): Promise<TelegramBoundUser | null>;
  updateTelegramChatId(userId: string, telegramChatId: string): Promise<TelegramBoundUser>;
  withTransaction<T>(
    operation: (repository: TelegramOnboardingRepository) => Promise<T>,
  ): Promise<T>;
};

export type TelegramMessageTransport = {
  sendMessage(chatId: string, text: string): Promise<void>;
};

export type BindTelegramCodeResult =
  | {
      activationToken: string;
      expiresAt: Date;
      status: "bound";
      telegramChatId: string;
      userId: string;
      username: string;
    }
  | { status: "chat_already_bound" }
  | { status: "invalid_code" };

type ActionLinkKind = "activation" | "password-reset";

function hashTelegramBindingCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function isStoredTokenActive(token: StoredTelegramActionToken, now: Date) {
  return (
    token.consumedAt === null &&
    token.invalidatedAt === null &&
    token.expiresAt.getTime() > now.getTime()
  );
}

export function formatTelegramBindingFailureMessage(
  status: "chat_already_bound" | "invalid_code",
) {
  return status === "chat_already_bound"
    ? "This Telegram account is already linked to another ALM user. Ask an admin to regenerate your onboarding code if you still need access."
    : "That Telegram binding code is invalid or expired. Ask an admin to generate a new one.";
}

export function createTelegramOnboardingRepository(
  db: PrismaExecutor = prisma,
): TelegramOnboardingRepository {
  const repository = createAuthRepository(db);

  return {
    createUserActionToken(data) {
      return repository.createUserActionToken(data);
    },
    expireUserActionTokens(now) {
      return repository.expireUserActionTokens(now);
    },
    findById(id: string) {
      return repository.findById(id);
    },
    async findBoundUserById(id: string) {
      return db.user.findUnique({
        where: { id },
        select: {
          id: true,
          telegramChatId: true,
          username: true,
        },
      });
    },
    findUserActionTokenByHash(tokenHash, tokenType) {
      return repository.findUserActionTokenByHash(tokenHash, tokenType);
    },
    async findByTelegramChatId(telegramChatId: string) {
      return db.user.findFirst({
        where: { telegramChatId },
        select: {
          id: true,
          telegramChatId: true,
          username: true,
        },
      });
    },
    invalidateActiveUserActionTokens(userId, tokenType, invalidatedAt) {
      return repository.invalidateActiveUserActionTokens(
        userId,
        tokenType,
        invalidatedAt,
      );
    },
    markUserActionTokenConsumed(tokenId, consumedAt) {
      return repository.markUserActionTokenConsumed(tokenId, consumedAt);
    },
    async updateTelegramChatId(userId: string, telegramChatId: string) {
      return db.user.update({
        where: { id: userId },
        data: { telegramChatId },
        select: {
          id: true,
          telegramChatId: true,
          username: true,
        },
      });
    },
    withTransaction(operation) {
      if ("$transaction" in db) {
        return db.$transaction((transaction) =>
          operation(createTelegramOnboardingRepository(transaction)),
        );
      }

      return operation(createTelegramOnboardingRepository(db));
    },
  };
}

function createTelegramActionLink(
  appBaseUrl: string,
  kind: ActionLinkKind,
  token: string,
) {
  const actionUrl = new URL(
    kind === "activation" ? "/activate" : "/reset-password",
    appBaseUrl,
  );
  actionUrl.searchParams.set("token", token);
  return actionUrl.toString();
}

export async function sendTelegramActivationLink(
  chatId: string,
  token: string,
  appBaseUrl: string,
  transport: TelegramMessageTransport,
) {
  const activationLink = createTelegramActionLink(appBaseUrl, "activation", token);
  await transport.sendMessage(
    chatId,
    [
      "Your ALM System activation link is ready.",
      activationLink,
      "This link expires in 5 minutes and can only be used once.",
    ].join("\n"),
  );
  return activationLink;
}

export async function sendTelegramPasswordResetLink(
  chatId: string,
  token: string,
  appBaseUrl: string,
  transport: TelegramMessageTransport,
) {
  const resetLink = createTelegramActionLink(appBaseUrl, "password-reset", token);
  await transport.sendMessage(
    chatId,
    [
      "Your ALM System password reset link is ready.",
      resetLink,
      "This link expires in 5 minutes and can only be used once.",
    ].join("\n"),
  );
  return resetLink;
}

export async function bindTelegramAccountByCode(
  code: string,
  telegramChatId: string,
  repository: TelegramOnboardingRepository = createTelegramOnboardingRepository(),
  now: Date = new Date(),
): Promise<BindTelegramCodeResult> {
  return repository.withTransaction(async (transactionRepository) => {
    const storedToken = (await transactionRepository.findUserActionTokenByHash(
      hashTelegramBindingCode(code.trim()),
      "TELEGRAM_BINDING",
    )) as StoredTelegramActionToken | null;
    if (!storedToken) {
      return { status: "invalid_code" };
    }

    const user = await transactionRepository.findBoundUserById(storedToken.userId);
    if (!user) {
      return { status: "invalid_code" };
    }

    const matchingBoundUser = await transactionRepository.findByTelegramChatId(
      telegramChatId,
    );
    if (matchingBoundUser && matchingBoundUser.id !== user.id) {
      return { status: "chat_already_bound" };
    }

    if (!isStoredTokenActive(storedToken, now)) {
      return { status: "invalid_code" };
    }

    try {
      const consumedToken = await consumeUserActionToken(
        code.trim(),
        "TELEGRAM_BINDING",
        transactionRepository,
        now,
      );
      if (!consumedToken) {
        return { status: "invalid_code" };
      }

      const boundUser =
        user.telegramChatId === telegramChatId
          ? user
          : await transactionRepository.updateTelegramChatId(
              user.id,
              telegramChatId,
            );
      const activationToken = await issueUserActionToken(
        user.id,
        "ACCOUNT_ACTIVATION",
        transactionRepository,
        now,
      );

      return {
        activationToken: activationToken.token,
        expiresAt: activationToken.expiresAt,
        status: "bound",
        telegramChatId: boundUser.telegramChatId ?? telegramChatId,
        userId: user.id,
        username: user.username,
      };
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError ||
          (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002")) &&
        error.code === "P2002"
      ) {
        return { status: "chat_already_bound" };
      }

      throw error;
    }
  });
}

export async function handleTelegramBindingCodeMessage(
  code: string,
  chatId: string,
  appBaseUrl: string,
  transport: TelegramMessageTransport,
  repository: TelegramOnboardingRepository = createTelegramOnboardingRepository(),
  now: Date = new Date(),
) {
  const bindingResult = await bindTelegramAccountByCode(
    code,
    chatId,
    repository,
    now,
  );

  if (bindingResult.status === "bound") {
    const activationLink = await sendTelegramActivationLink(
      bindingResult.telegramChatId,
      bindingResult.activationToken,
      appBaseUrl,
      transport,
    );

    return {
      activationLink,
      ...bindingResult,
    };
  }

  await transport.sendMessage(
    chatId,
    formatTelegramBindingFailureMessage(bindingResult.status),
  );
  return bindingResult;
}
