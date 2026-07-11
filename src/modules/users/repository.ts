import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";

export type ManagedUser = Pick<
  User,
  | "id"
  | "username"
  | "role"
  | "isActive"
  | "sessionVersion"
  | "lastLoginAt"
  | "createdAt"
  | "updatedAt"
>;

const managedUserSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  sessionVersion: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserManagementRepository = {
  countActiveAdmins(): Promise<number>;
  create(data: {
    isActive: boolean;
    role: "ADMIN" | "USER";
    username: string;
  }): Promise<ManagedUser>;
  findById(id: string): Promise<ManagedUser | null>;
  findByUsername(username: string): Promise<ManagedUser | null>;
  list(): Promise<ManagedUser[]>;
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
      isActive: boolean;
      role: "ADMIN" | "USER";
      username: string;
    }): Promise<ManagedUser> {
      return db.user.create({
        data: {
          username: data.username,
          role: data.role,
          isActive: data.isActive,
          passwordHash: null,
        },
        select: managedUserSelect,
      });
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
    list(): Promise<ManagedUser[]> {
      return db.user.findMany({
        orderBy: [{ role: "asc" }, { username: "asc" }],
        select: managedUserSelect,
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
