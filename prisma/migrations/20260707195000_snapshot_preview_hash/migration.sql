PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "previewHash" TEXT,
    "status" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "totalAssets" DECIMAL NOT NULL,
    "totalLiabilities" DECIMAL NOT NULL,
    "netWorth" DECIMAL NOT NULL,
    "cashPosition" DECIMAL NOT NULL,
    "investmentValue" DECIMAL NOT NULL,
    "monthlyDebtPaymentTotal" DECIMAL NOT NULL,
    "snapshotAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Snapshot" ("baseCurrency", "cashPosition", "createdAt", "id", "investmentValue", "monthlyDebtPaymentTotal", "netWorth", "previewHash", "snapshotAt", "status", "totalAssets", "totalLiabilities", "userId")
SELECT "baseCurrency", "cashPosition", "createdAt", "id", "investmentValue", "monthlyDebtPaymentTotal", "netWorth", NULL, "snapshotAt", "status", "totalAssets", "totalLiabilities", "userId" FROM "Snapshot";
DROP TABLE "Snapshot";
ALTER TABLE "new_Snapshot" RENAME TO "Snapshot";
CREATE INDEX "Snapshot_userId_snapshotAt_idx" ON "Snapshot"("userId", "snapshotAt" DESC);
CREATE UNIQUE INDEX "Snapshot_userId_previewHash_key" ON "Snapshot"("userId", "previewHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
