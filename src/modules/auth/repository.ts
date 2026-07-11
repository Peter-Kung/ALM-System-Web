import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";

export type AuthUser = Pick<
  User,
  | "id"
  | "username"
  | "passwordHash"
  | "role"
  | "isActive"
  | "sessionVersion"
  | "lastLoginAt"
  | "createdAt"
>;

const authUserSelect = {
  id: true,
  username: true,
  passwordHash: true,
  role: true,
  isActive: true,
  sessionVersion: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export function createAuthRepository(db: PrismaExecutor = prisma) {
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
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
