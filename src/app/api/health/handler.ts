import { NextResponse } from "next/server";

import { prisma as defaultPrisma } from "@/lib/prisma";

type HealthPrisma = {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type HealthHandlerDependencies = {
  prisma?: HealthPrisma;
};

export async function healthHandler({
  prisma = defaultPrisma,
}: HealthHandlerDependencies = {}) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      {
        status: "error",
        checks: {
          database: "error",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    checks: {
      database: "ok",
    },
  });
}
