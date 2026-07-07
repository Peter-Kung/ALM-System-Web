import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import { assertNonEmptyString } from "@/lib/repository-utils";

export function createAssetRepository(db: PrismaExecutor = prisma) {
  return {
    create(data: Prisma.AssetUncheckedCreateInput) {
      assertNonEmptyString(data.name, "name");
      assertNonEmptyString(data.currency, "currency");

      return db.asset.create({ data });
    },
    findById(id: string) {
      return db.asset.findUnique({
        where: { id },
        include: { holdings: true, priceRecords: true },
      });
    },
    listByUser(userId: string) {
      return db.asset.findMany({
        where: { userId },
        include: { holdings: true, priceRecords: true },
        orderBy: { createdAt: "asc" },
      });
    },
    update(id: string, data: Prisma.AssetUncheckedUpdateInput) {
      if (typeof data.name === "string") {
        assertNonEmptyString(data.name, "name");
      }

      if (typeof data.currency === "string") {
        assertNonEmptyString(data.currency, "currency");
      }

      return db.asset.update({
        where: { id },
        data,
      });
    },
  };
}
