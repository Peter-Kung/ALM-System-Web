import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertPositive,
  RepositoryValidationError,
  withWriteValidation,
} from "@/lib/repository-utils";

export function createHoldingRepository(db: PrismaExecutor = prisma) {
  async function assertHoldingOwnership(
    executor: PrismaExecutor,
    accountId: string,
    assetId: string,
    expectedUserId?: string,
  ) {
    const [account, asset] = await Promise.all([
      executor.account.findUnique({
        where: { id: accountId },
        select: { userId: true },
      }),
      executor.asset.findUnique({
        where: { id: assetId },
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

    if (expectedUserId && account.userId !== expectedUserId) {
      throw new RepositoryValidationError(
        "Holding account and asset must belong to the authenticated user.",
      );
    }
  }

  return {
    async create(data: Prisma.HoldingUncheckedCreateInput, expectedUserId?: string) {
      assertPositive(data.quantity, "quantity");

      return withWriteValidation(db, async (executor) => {
        await assertHoldingOwnership(
          executor,
          data.accountId,
          data.assetId,
          expectedUserId,
        );

        return executor.holding.create({
          data,
          include: { account: true, asset: true },
        });
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
    listByUser(userId: string) {
      return db.holding.findMany({
        where: { account: { userId } },
        include: { account: true, asset: true },
        orderBy: { createdAt: "asc" },
      });
    },
    async update(
      id: string,
      data: Prisma.HoldingUncheckedUpdateInput,
      expectedUserId?: string,
    ) {
      if (data.quantity !== undefined) {
        assertPositive(data.quantity, "quantity");
      }

      return withWriteValidation(db, async (executor) => {
        const existingHolding = await executor.holding.findUnique({
          where: { id },
          select: { accountId: true, assetId: true },
        });

        if (!existingHolding) {
          throw new RepositoryValidationError("Holding not found.");
        }

        const accountId =
          typeof data.accountId === "string" ? data.accountId : existingHolding.accountId;
        const assetId =
          typeof data.assetId === "string" ? data.assetId : existingHolding.assetId;

        await assertHoldingOwnership(executor, accountId, assetId, expectedUserId);

        return executor.holding.update({
          where: { id },
          data,
          include: { account: true, asset: true },
        });
      });
    },
  };
}
