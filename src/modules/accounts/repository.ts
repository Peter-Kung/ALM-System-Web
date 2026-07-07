import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PrismaExecutor } from "@/lib/prisma-executor";
import {
  assertNonEmptyString,
  assertNonNegative,
} from "@/lib/repository-utils";

export function createAccountRepository(db: PrismaExecutor = prisma) {
  return {
    create(data: Prisma.AccountUncheckedCreateInput) {
      assertNonEmptyString(data.name, "name");
      assertNonEmptyString(data.institutionName, "institutionName");
      assertNonEmptyString(data.currency, "currency");
      assertNonNegative(data.cashBalance, "cashBalance");

      return db.account.create({ data });
    },
    findById(id: string) {
      return db.account.findUnique({
        where: { id },
        include: { holdings: true, paymentLiabilities: true },
      });
    },
    listByUser(userId: string) {
      return db.account.findMany({
        where: { userId },
        include: { holdings: true, paymentLiabilities: true },
        orderBy: { createdAt: "asc" },
      });
    },
  };
}
