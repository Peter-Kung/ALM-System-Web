import type { Prisma, User, UserActionToken, UserActionTokenType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";

export type ManagedUser = Pick<
  User,
  | "id"
  | "username"
  | "displayName"
  | "role"
  | "isActive"
  | "sessionVersion"
  | "failedLoginAttempts"
  | "lockedUntil"
  | "lastLoginAt"
  | "telegramUsername"
  | "telegramBoundAt"
  | "createdAt"
  | "updatedAt"
>;

export type ManagedUserActionToken = Pick<
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

const managedUserSelect = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  sessionVersion: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  telegramUsername: true,
  telegramBoundAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const managedUserActionTokenSelect = {
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

export type UserManagementRepository = {
  countActiveAdmins(): Promise<number>;
  create(data: {
    displayName?: string | null;
    isActive: boolean;
    role: "ADMIN" | "USER";
    username: string;
  }): Promise<ManagedUser>;
  createUserActionToken(
    data: Prisma.UserActionTokenUncheckedCreateInput,
  ): Promise<ManagedUserActionToken>;
  expireUserActionTokens(now: Date): Promise<number>;
  findById(id: string): Promise<ManagedUser | null>;
  findByUsername(username: string): Promise<ManagedUser | null>;
  findUserActionTokenByHash(
    tokenHash: string,
    tokenType: UserActionTokenType,
  ): Promise<ManagedUserActionToken | null>;
  invalidateActiveUserActionTokens(
    userId: string,
    tokenType: UserActionTokenType,
    invalidatedAt: Date,
  ): Promise<number>;
  list(): Promise<ManagedUser[]>;
  markUserActionTokenConsumed(
    tokenId: string,
    consumedAt: Date,
  ): Promise<ManagedUserActionToken | null>;
  update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<ManagedUser>;
  withTransaction<T>(
    operation: (repository: UserManagementRepository) => Promise<T>,
  ): Promise<T>;
};

export function createUserManagementRepository(
  db: PrismaExecutor = prisma,
): UserManagementRepository {
  return {
    countActiveAdmins(): Promise<number> {
      return db.user.count({
        where: {
          isActive: true,
          role: "ADMIN",
        },
      });
    },
    create(data: {
      displayName?: string | null;
      isActive: boolean;
      role: "ADMIN" | "USER";
      username: string;
    }): Promise<ManagedUser> {
      return db.user.create({
        data: {
          username: data.username,
          displayName: data.displayName,
          role: data.role,
          status: data.isActive ? "ACTIVE" : "DISABLED",
          isActive: data.isActive,
          passwordHash: null,
          sessionVersion: 1,
        },
        select: managedUserSelect,
      });
    },
    createUserActionToken(
      data: Prisma.UserActionTokenUncheckedCreateInput,
    ): Promise<ManagedUserActionToken> {
      return db.userActionToken.create({
        data,
        select: managedUserActionTokenSelect,
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
    findById(id: string): Promise<ManagedUser | null> {
      return db.user.findUnique({
        where: { id },
        select: managedUserSelect,
      });
    },
    findByUsername(username: string): Promise<ManagedUser | null> {
      return db.user.findUnique({
        where: { username },
        select: managedUserSelect,
      });
    },
    findUserActionTokenByHash(
      tokenHash: string,
      tokenType: UserActionTokenType,
    ): Promise<ManagedUserActionToken | null> {
      return db.userActionToken.findFirst({
        where: {
          tokenHash,
          tokenType,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: managedUserActionTokenSelect,
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
    list(): Promise<ManagedUser[]> {
      return db.user.findMany({
        orderBy: [{ role: "asc" }, { username: "asc" }],
        select: managedUserSelect,
      });
    },
    async markUserActionTokenConsumed(
      tokenId: string,
      consumedAt: Date,
    ): Promise<ManagedUserActionToken | null> {
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
        select: managedUserActionTokenSelect,
      });
    },
    update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<ManagedUser> {
      return db.user.update({
        where: { id },
        data,
        select: managedUserSelect,
      });
    },
    withTransaction<T>(
      operation: (repository: UserManagementRepository) => Promise<T>,
    ): Promise<T> {
      if ("$transaction" in db) {
        return db.$transaction((transaction) =>
          operation(createUserManagementRepository(transaction)),
        );
      }

      return operation(createUserManagementRepository(db));
    },
  };
}
