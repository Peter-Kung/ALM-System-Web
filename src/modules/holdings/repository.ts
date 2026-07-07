import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertPositive,
  RepositoryValidationError,
  withWriteValidation,
} from "@/lib/repository-utils";

export function createHoldingRepository(db: PrismaExecutor = prisma) {
  return {
    async create(data: Prisma.HoldingUncheckedCreateInput) {
      assertPositive(data.quantity, "quantity");

      return withWriteValidation(db, async (executor) => {
        const [account, asset] = await Promise.all([
          executor.account.findUnique({
            where: { id: data.accountId },
            select: { userId: true },
          }),
          executor.asset.findUnique({
            where: { id: data.assetId },
            select: { userId: true },
          }),
        ]);

        if (!account) {
          throw new RepositoryValidationError("Account not found.");
        }

        if (!asset) {
          throw new RepositoryValidationError("Asset not found.");
        }

        if (account.userId !== asset.userId) {
          throw new RepositoryValidationError(
            "Holding account and asset must belong to the same user.",
          );
        }

        return executor.holding.create({ data });
      });
    },
    findById(id: string) {
      return db.holding.findUnique({
        where: { id },
        include: { account: true, asset: true },
      });
    },
    listByAccount(accountId: string) {
      return db.holding.findMany({
        where: { accountId },
        include: { account: true, asset: true },
        orderBy: { createdAt: "asc" },
      });
    },
  };
}
