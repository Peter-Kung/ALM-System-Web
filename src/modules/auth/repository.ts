import type {
  Prisma,
  User,
  UserActionToken,
  UserActionTokenType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import type { UserActionTokenRepository } from "@/modules/auth/action-token";

export type AuthUser = Pick<
  User,
  | "id"
  | "displayName"
  | "username"
  | "passwordHash"
  | "role"
  | "isActive"
  | "sessionVersion"
  | "lastLoginAt"
  | "createdAt"
>;

export type AuthUserActionToken = Pick<
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

const authUserSelect = {
  id: true,
  displayName: true,
  username: true,
  passwordHash: true,
  role: true,
  isActive: true,
  sessionVersion: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const authUserActionTokenSelect = {
  id: true,
  userId: true,
  tokenType: true,
  tokenHash: true,
  expiresAt: true,
  consumedAt: true,
  invalidatedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserActionTokenSelect;

export type AuthRepository = {
  create(data: Prisma.UserCreateInput): Promise<AuthUser>;
  createFirstAdministrator(data: {
    passwordHash: string;
    username: string;
  }): Promise<AuthUser>;
  findById(id: string): Promise<AuthUser | null>;
  findByUsername(username: string): Promise<AuthUser | null>;
  findFirstUser(): Promise<AuthUser | null>;
  findFirstUserWithPasswordHash(): Promise<AuthUser | null>;
  update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<AuthUser>;
};

export function createAuthRepository(
  db: PrismaExecutor = prisma,
): AuthRepository & UserActionTokenRepository {
  return {
    findById(id: string): Promise<AuthUser | null> {
      return db.user.findUnique({
        where: { id },
        select: authUserSelect,
      });
    },
    findByUsername(username: string): Promise<AuthUser | null> {
      return db.user.findUnique({
        where: { username },
        select: authUserSelect,
      });
    },
    findFirstUser(): Promise<AuthUser | null> {
      return db.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: authUserSelect,
      });
    },
    findFirstUserWithPasswordHash(): Promise<AuthUser | null> {
      return db.user.findFirst({
        where: {
          passwordHash: {
            not: null,
          },
        },
        orderBy: { createdAt: "asc" },
        select: authUserSelect,
      });
    },
    create(data: Prisma.UserCreateInput): Promise<AuthUser> {
      return db.user.create({
        data,
        select: authUserSelect,
      });
    },
    async createFirstAdministrator(data: {
      passwordHash: string;
      username: string;
    }): Promise<AuthUser> {
      return db.user.create({
        data: {
          username: data.username,
          passwordHash: data.passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          isActive: true,
          sessionVersion: 1,
          bootstrapKey: "single-user",
        },
        select: authUserSelect,
      });
    },
    update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<AuthUser> {
      return db.user.update({
        where: { id },
        data,
        select: authUserSelect,
      });
    },
    createUserActionToken(
      data: Prisma.UserActionTokenUncheckedCreateInput,
    ): Promise<AuthUserActionToken> {
      return db.userActionToken.create({
        data,
        select: authUserActionTokenSelect,
      });
    },
    expireUserActionTokens(now: Date): Promise<number> {
      return db.userActionToken
        .updateMany({
          where: {
            consumedAt: null,
            invalidatedAt: null,
            expiresAt: {
              lte: now,
            },
          },
          data: {
            invalidatedAt: now,
          },
        })
        .then((result) => result.count);
    },
    findUserActionTokenByHash(
      tokenHash: string,
      tokenType: UserActionTokenType,
    ): Promise<AuthUserActionToken | null> {
      return db.userActionToken.findFirst({
        where: {
          tokenHash,
          tokenType,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: authUserActionTokenSelect,
      });
    },
    invalidateActiveUserActionTokens(
      userId: string,
      tokenType: UserActionTokenType,
      invalidatedAt: Date,
    ): Promise<number> {
      return db.userActionToken
        .updateMany({
          where: {
            userId,
            tokenType,
            consumedAt: null,
            invalidatedAt: null,
            expiresAt: {
              gt: invalidatedAt,
            },
          },
          data: {
            invalidatedAt,
          },
        })
        .then((result) => result.count);
    },
    async markUserActionTokenConsumed(
      tokenId: string,
      consumedAt: Date,
    ): Promise<AuthUserActionToken | null> {
      const result = await db.userActionToken.updateMany({
        where: {
          id: tokenId,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: {
            gt: consumedAt,
          },
        },
        data: {
          consumedAt,
        },
      });
      if (result.count === 0) {
        return null;
      }

      return db.userActionToken.findUnique({
        where: { id: tokenId },
        select: authUserActionTokenSelect,
      });
    },
    withTransaction<T>(
      operation: (repository: UserActionTokenRepository) => Promise<T>,
    ): Promise<T> {
      if ("$transaction" in db) {
        return db.$transaction((transaction) =>
          operation(createAuthRepository(transaction)),
        );
      }

      return operation(createAuthRepository(db));
    },
  };
}
