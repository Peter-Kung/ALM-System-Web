import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { UserActionToken, UserActionTokenType } from "@prisma/client";

import { RepositoryValidationError } from "@/lib/repository-utils";

const ACTION_TOKEN_TTL_MS = 5 * 60 * 1000;

export type StoredUserActionToken = Pick<
  UserActionToken,
  | "id"
  | "userId"
  | "tokenType"
  | "tokenHash"
  | "expiresAt"
  | "consumedAt"
  | "invalidatedAt"
  | "createdAt"
  | "updatedAt"
>;

export type UserActionTokenRecord = Omit<StoredUserActionToken, "tokenHash">;

export type IssuedUserActionToken = {
  expiresAt: Date;
  token: string;
  tokenType: UserActionTokenType;
  userId: string;
};

export type UserActionTokenRepository = {
  createUserActionToken(
    data: Prisma.UserActionTokenUncheckedCreateInput,
  ): Promise<StoredUserActionToken>;
  expireUserActionTokens(now: Date): Promise<number>;
  findById(id: string): Promise<{ id: string } | null>;
  findUserActionTokenByHash(
    tokenHash: string,
    tokenType: UserActionTokenType,
  ): Promise<StoredUserActionToken | null>;
  invalidateActiveUserActionTokens(
    userId: string,
    tokenType: UserActionTokenType,
    invalidatedAt: Date,
  ): Promise<number>;
  markUserActionTokenConsumed(
    tokenId: string,
    consumedAt: Date,
  ): Promise<StoredUserActionToken | null>;
  withTransaction<T>(
    operation: (repository: UserActionTokenRepository) => Promise<T>,
  ): Promise<T>;
};

function hashActionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isActionTokenValid(token: StoredUserActionToken, now: Date) {
  return (
    token.consumedAt === null &&
    token.invalidatedAt === null &&
    token.expiresAt.getTime() > now.getTime()
  );
}

function serializeTokenRecord(token: StoredUserActionToken): UserActionTokenRecord {
  return {
    id: token.id,
    userId: token.userId,
    tokenType: token.tokenType,
    expiresAt: token.expiresAt,
    consumedAt: token.consumedAt,
    invalidatedAt: token.invalidatedAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

async function requireExistingUser(
  repository: UserActionTokenRepository,
  userId: string,
) {
  const user = await repository.findById(userId);
  if (!user) {
    throw new RepositoryValidationError("User was not found.");
  }
}

async function issueUserActionTokenOnce(
  userId: string,
  tokenType: UserActionTokenType,
  repository: UserActionTokenRepository,
  now: Date,
): Promise<IssuedUserActionToken> {
  return repository.withTransaction(async (transactionRepository) => {
    await requireExistingUser(transactionRepository, userId);
    await transactionRepository.expireUserActionTokens(now);

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(now.getTime() + ACTION_TOKEN_TTL_MS);

    await transactionRepository.invalidateActiveUserActionTokens(
      userId,
      tokenType,
      now,
    );
    await transactionRepository.createUserActionToken({
      userId,
      tokenType,
      tokenHash: hashActionToken(token),
      expiresAt,
    });

    return {
      token,
      expiresAt,
      tokenType,
      userId,
    };
  });
}

export async function issueUserActionToken(
  userId: string,
  tokenType: UserActionTokenType,
  repository: UserActionTokenRepository,
  now: Date = new Date(),
): Promise<IssuedUserActionToken> {
  try {
    return await issueUserActionTokenOnce(userId, tokenType, repository, now);
  } catch (error) {
    // Partial unique indexes guard one active token per user/type across races.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return issueUserActionTokenOnce(userId, tokenType, repository, now);
    }

    throw error;
  }
}

export async function validateUserActionToken(
  token: string,
  tokenType: UserActionTokenType,
  repository: UserActionTokenRepository,
  now: Date = new Date(),
): Promise<UserActionTokenRecord | null> {
  const storedToken = await repository.findUserActionTokenByHash(
    hashActionToken(token),
    tokenType,
  );
  if (!storedToken || !isActionTokenValid(storedToken, now)) {
    return null;
  }

  return serializeTokenRecord(storedToken);
}

export async function consumeUserActionToken(
  token: string,
  tokenType: UserActionTokenType,
  repository: UserActionTokenRepository,
  now: Date = new Date(),
): Promise<UserActionTokenRecord | null> {
  return repository.withTransaction(async (transactionRepository) => {
    const storedToken = await transactionRepository.findUserActionTokenByHash(
      hashActionToken(token),
      tokenType,
    );
    if (!storedToken || !isActionTokenValid(storedToken, now)) {
      return null;
    }

    const consumedToken = await transactionRepository.markUserActionTokenConsumed(
      storedToken.id,
      now,
    );
    if (!consumedToken) {
      return null;
    }

    return serializeTokenRecord(consumedToken);
  });
}

export function expireUserActionTokens(
  repository: UserActionTokenRepository,
  now: Date = new Date(),
) {
  return repository.expireUserActionTokens(now);
}
