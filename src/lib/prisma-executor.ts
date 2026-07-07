import { Prisma, PrismaClient } from "@prisma/client";

export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
