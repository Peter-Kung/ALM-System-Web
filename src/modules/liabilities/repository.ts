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

        return executor.liability.create({ data });
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
  };
}
