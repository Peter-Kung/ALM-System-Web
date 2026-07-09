import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";

export type AuthUser = Pick<User, "id" | "username" | "passwordHash" | "createdAt">;

export function createAuthRepository(db: PrismaExecutor = prisma) {
  return {
    findByUsername(username: string): Promise<AuthUser | null> {
      return db.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          passwordHash: true,
          createdAt: true,
        },
      });
    },
    findFirstUser(): Promise<AuthUser | null> {
      return db.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          username: true,
          passwordHash: true,
          createdAt: true,
        },
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
        select: {
          id: true,
          username: true,
          passwordHash: true,
          createdAt: true,
        },
      });
    },
    create(data: Prisma.UserCreateInput): Promise<AuthUser> {
      return db.user.create({
        data,
        select: {
          id: true,
          username: true,
          passwordHash: true,
          createdAt: true,
        },
      });
    },
    update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<AuthUser> {
      return db.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          passwordHash: true,
          createdAt: true,
        },
      });
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
