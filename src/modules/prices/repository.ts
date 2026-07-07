import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertNonEmptyString,
  assertPositive,
  RepositoryValidationError,
  withWriteValidation,
} from "@/lib/repository-utils";

export function createPriceRecordRepository(db: PrismaExecutor = prisma) {
  return {
    async create(
      data: Prisma.PriceRecordUncheckedCreateInput,
      expectedUserId?: string,
    ) {
      assertNonEmptyString(data.currency, "currency");
      assertPositive(data.price, "price");

      return withWriteValidation(db, async (executor) => {
        const asset = await executor.asset.findUnique({
          where: { id: data.assetId },
          select: { userId: true },
        });

        if (!asset) {
          throw new RepositoryValidationError("Asset not found.");
        }

        if (expectedUserId && asset.userId !== expectedUserId) {
          throw new RepositoryValidationError(
            "Price record asset must belong to the authenticated user.",
          );
        }

        return executor.priceRecord.create({
          data,
          include: { asset: true },
        });
      });
    },
    findLatestForAsset(assetId: string) {
      return db.priceRecord.findFirst({
        where: { assetId, isValid: true },
        include: { asset: true },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      });
    },
    listLatestByUser(userId: string) {
      return db.priceRecord.findMany({
        where: { asset: { userId } },
        include: { asset: true },
        orderBy: [
          { assetId: "asc" },
          { recordedAt: "desc" },
          { createdAt: "desc" },
        ],
      });
    },
    listByAsset(assetId: string) {
      return db.priceRecord.findMany({
        where: { assetId },
        include: { asset: true },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      });
    },
  };
}
