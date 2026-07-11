import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

const OLD_SCHEMA_MIGRATIONS = [
  "20260707165615_init",
  "20260707171429_add_core_models",
  "20260707191000_snapshot_confirmation",
  "20260707195000_snapshot_preview_hash",
  "20260709175506_add_user_password_hash",
];

function runPrisma(
  args: string[],
  options: {
    env?: Record<string, string | undefined>;
    input?: string;
  } = {},
) {
  const prismaBin = join(process.cwd(), "node_modules", ".bin", "prisma");
  const command = existsSync(prismaBin) ? prismaBin : "npx";
  const commandArgs = existsSync(prismaBin) ? args : ["prisma", ...args];

  execFileSync(command, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...options.env,
    },
    input: options.input,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function readMigration(name: string) {
  return readFileSync(
    join(process.cwd(), "prisma", "migrations", name, "migration.sql"),
    "utf8",
  );
}

function appliedMigrationRow(name: string) {
  return `
INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES
  ('${name}', 'test-checksum', '2026-07-11 00:00:00', '${name}', '2026-07-11 00:00:00', 1);
`;
}

function createOldSchemaSql() {
  const migrationTableSql = `
CREATE TABLE "_prisma_migrations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
`;

  const seedSql = `
INSERT INTO "User"
  ("id", "username", "createdAt", "updatedAt", "passwordHash")
VALUES
  ('user-1', 'owner', '2026-07-01 00:00:00', '2026-07-01 00:00:00', 'hash');

INSERT INTO "Account"
  ("id", "userId", "name", "institutionName", "accountType", "currency", "cashBalance", "isActive", "createdAt", "updatedAt")
VALUES
  ('account-1', 'user-1', 'Cash', 'Bank', 'BANK', 'TWD', 1000, true, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO "Asset"
  ("id", "userId", "name", "assetType", "currency", "priceSourceType", "isActive", "createdAt", "updatedAt")
VALUES
  ('asset-1', 'user-1', 'Fund', 'FUND', 'TWD', 'MANUAL', true, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO "Holding"
  ("id", "accountId", "assetId", "quantity", "isActive", "createdAt", "updatedAt")
VALUES
  ('holding-1', 'account-1', 'asset-1', 2, true, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO "Liability"
  ("id", "userId", "name", "liabilityType", "currency", "originalAmount", "currentBalance", "interestRate", "monthlyPayment", "startDate", "isActive", "createdAt", "updatedAt")
VALUES
  ('liability-1', 'user-1', 'Loan', 'PERSONAL_LOAN', 'TWD', 5000, 4000, 1.5, 500, '2026-07-01 00:00:00', true, '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO "PriceRecord"
  ("id", "assetId", "sourceType", "currency", "price", "recordedAt", "isValid", "createdAt")
VALUES
  ('price-1', 'asset-1', 'MANUAL_ENTRY', 'TWD', 50, '2026-07-01 00:00:00', true, '2026-07-01 00:00:00');

INSERT INTO "Snapshot"
  ("id", "userId", "previewHash", "status", "baseCurrency", "totalAssets", "totalLiabilities", "netWorth", "cashPosition", "investmentValue", "monthlyDebtPaymentTotal", "snapshotAt", "createdAt")
VALUES
  ('snapshot-1', 'user-1', 'preview-1', 'COMPLETE', 'TWD', 1100, 4000, -2900, 1000, 100, 500, '2026-07-01 00:00:00', '2026-07-01 00:00:00');
`;

  return [
    migrationTableSql,
    ...OLD_SCHEMA_MIGRATIONS.flatMap((name) => [
      readMigration(name),
      appliedMigrationRow(name),
    ]),
    seedSql,
  ].join("\n");
}

test("Prisma migrate deploy upgrades old local SQLite data without resetting it", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "alm-sqlite-migration-"));
  const databaseUrl = `file:${join(tempDir, "dev.db")}`;

  try {
    runPrisma(["db", "execute", "--stdin", "--url", databaseUrl], {
      input: createOldSchemaSql(),
    });
    runPrisma(["migrate", "deploy"], {
      env: {
        DATABASE_URL: databaseUrl,
      },
    });

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    try {
      const user = await prisma.user.findFirstOrThrow({
        select: {
          isActive: true,
          role: true,
          sessionVersion: true,
          username: true,
        },
      });

      assert.deepEqual(user, {
        username: "owner",
        role: "ADMIN",
        isActive: true,
        sessionVersion: 0,
      });

      assert.equal(await prisma.account.count(), 1);
      assert.equal(await prisma.asset.count(), 1);
      assert.equal(await prisma.holding.count(), 1);
      assert.equal(await prisma.liability.count(), 1);
      assert.equal(await prisma.priceRecord.count(), 1);
      assert.equal(await prisma.snapshot.count(), 1);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    rmSync(tempDir, {
      force: true,
      recursive: true,
    });
  }
});
