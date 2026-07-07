import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertNonEmptyString,
  assertPositive,
} from "@/lib/repository-utils";

export function createPriceRecordRepository(db: PrismaExecutor = prisma) {
  return {
    create(data: Prisma.PriceRecordUncheckedCreateInput) {
      assertNonEmptyString(data.currency, "currency");
      assertPositive(data.price, "price");

      return db.priceRecord.create({ data });
    },
    findLatestForAsset(assetId: string) {
      return db.priceRecord.findFirst({
        where: { assetId, isValid: true },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      });
    },
    listByAsset(assetId: string) {
      return db.priceRecord.findMany({
        where: { assetId },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      });
    },
  };
}
