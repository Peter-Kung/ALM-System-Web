import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertDateOrder,
  assertNonEmptyString,
  assertNonNegative,
  RepositoryValidationError,
  withWriteValidation,
} from "@/lib/repository-utils";

export function createLiabilityRepository(db: PrismaExecutor = prisma) {
  return {
    async create(data: Prisma.LiabilityUncheckedCreateInput) {
      assertNonEmptyString(data.name, "name");
      assertNonEmptyString(data.currency, "currency");
      assertNonNegative(data.originalAmount, "originalAmount");
      assertNonNegative(data.currentBalance, "currentBalance");
      assertNonNegative(data.interestRate, "interestRate");
      assertNonNegative(data.monthlyPayment, "monthlyPayment");
      assertDateOrder(data.startDate, data.endDate, "startDate", "endDate");

      return withWriteValidation(db, async (executor) => {
        if (data.paymentAccountId) {
          const paymentAccount = await executor.account.findUnique({
            where: { id: data.paymentAccountId },
            select: { userId: true },
          });

          if (!paymentAccount) {
            throw new RepositoryValidationError("Payment account not found.");
          }

          if (paymentAccount.userId !== data.userId) {
            throw new RepositoryValidationError(
              "Liability payment account must belong to the same user.",
            );
          }
        }

        return executor.liability.create({
          data,
          include: { paymentAccount: true },
        });
      });
    },
    findById(id: string) {
      return db.liability.findUnique({
        where: { id },
        include: { paymentAccount: true },
      });
    },
    listByUser(userId: string) {
      return db.liability.findMany({
        where: { userId },
        include: { paymentAccount: true },
        orderBy: { createdAt: "asc" },
      });
    },
    async update(id: string, data: Prisma.LiabilityUncheckedUpdateInput, expectedUserId: string) {
      if (typeof data.name === "string") {
        assertNonEmptyString(data.name, "name");
      }

      if (typeof data.currency === "string") {
        assertNonEmptyString(data.currency, "currency");
      }

      if (data.originalAmount !== undefined) {
        assertNonNegative(data.originalAmount, "originalAmount");
      }

      if (data.currentBalance !== undefined) {
        assertNonNegative(data.currentBalance, "currentBalance");
      }

      if (data.interestRate !== undefined) {
        assertNonNegative(data.interestRate, "interestRate");
      }

      if (data.monthlyPayment !== undefined) {
        assertNonNegative(data.monthlyPayment, "monthlyPayment");
      }

      return withWriteValidation(db, async (executor) => {
        const existingLiability = await executor.liability.findUnique({
          where: { id },
          select: {
            userId: true,
            startDate: true,
            endDate: true,
            paymentAccountId: true,
          },
        });

        if (!existingLiability) {
          throw new RepositoryValidationError("Liability not found.");
        }

        if (existingLiability.userId !== expectedUserId) {
          throw new RepositoryValidationError(
            "Liability must belong to the authenticated user.",
          );
        }

        const startDate =
          data.startDate instanceof Date ? data.startDate : existingLiability.startDate;
        const endDate =
          data.endDate === null
            ? null
            : data.endDate instanceof Date
              ? data.endDate
              : existingLiability.endDate;

        assertDateOrder(startDate, endDate, "startDate", "endDate");

        const paymentAccountId =
          data.paymentAccountId === null
            ? null
            : typeof data.paymentAccountId === "string"
              ? data.paymentAccountId
              : existingLiability.paymentAccountId;

        if (paymentAccountId) {
          const paymentAccount = await executor.account.findUnique({
            where: { id: paymentAccountId },
            select: { userId: true },
          });

          if (!paymentAccount) {
            throw new RepositoryValidationError("Payment account not found.");
          }

          if (paymentAccount.userId !== existingLiability.userId) {
            throw new RepositoryValidationError(
              "Liability payment account must belong to the same user.",
            );
          }
        }

        return executor.liability.update({
          where: { id },
          data,
          include: { paymentAccount: true },
        });
      });
    },
  };
}
