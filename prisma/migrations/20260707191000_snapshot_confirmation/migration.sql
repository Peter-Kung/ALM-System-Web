PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SnapshotHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "sourceHoldingId" TEXT,
    "sourceAccountId" TEXT,
    "sourceAssetId" TEXT,
    "accountName" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "symbol" TEXT,
    "quantity" DECIMAL NOT NULL,
    "assetCurrency" TEXT NOT NULL,
    "priceAmount" DECIMAL,
    "priceCurrency" TEXT,
    "priceRecordedAt" DATETIME,
    "fxRateToBase" DECIMAL,
    "marketValue" DECIMAL NOT NULL,
    CONSTRAINT "SnapshotHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SnapshotHolding" ("accountName", "assetCurrency", "assetName", "assetType", "fxRateToBase", "id", "marketValue", "priceAmount", "priceCurrency", "quantity", "snapshotId", "sourceAccountId", "sourceAssetId", "sourceHoldingId", "symbol")
SELECT "accountName", "assetCurrency", "assetName", "assetType", "fxRateToBase", "id", "marketValue", "priceAmount", "priceCurrency", "quantity", "snapshotId", "sourceAccountId", "sourceAssetId", "sourceHoldingId", "symbol" FROM "SnapshotHolding";
DROP TABLE "SnapshotHolding";
ALTER TABLE "new_SnapshotHolding" RENAME TO "SnapshotHolding";
CREATE INDEX "SnapshotHolding_snapshotId_idx" ON "SnapshotHolding"("snapshotId");
CREATE INDEX "SnapshotHolding_sourceHoldingId_idx" ON "SnapshotHolding"("sourceHoldingId");
CREATE TABLE "new_SnapshotLiability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "sourceLiabilityId" TEXT,
    "liabilityName" TEXT NOT NULL,
    "liabilityType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "currentBalance" DECIMAL NOT NULL,
    "monthlyPayment" DECIMAL NOT NULL,
    "fxRateToBase" DECIMAL,
    "balanceValue" DECIMAL NOT NULL,
    "monthlyPaymentValue" DECIMAL NOT NULL,
    "paymentAccountName" TEXT,
    CONSTRAINT "SnapshotLiability_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SnapshotLiability" ("balanceValue", "currency", "currentBalance", "fxRateToBase", "id", "liabilityName", "liabilityType", "monthlyPayment", "monthlyPaymentValue", "paymentAccountName", "snapshotId", "sourceLiabilityId")
SELECT "balanceValue", "currency", "currentBalance", "fxRateToBase", "id", "liabilityName", "liabilityType", "monthlyPayment", "monthlyPaymentValue", "paymentAccountName", "snapshotId", "sourceLiabilityId" FROM "SnapshotLiability";
DROP TABLE "SnapshotLiability";
ALTER TABLE "new_SnapshotLiability" RENAME TO "SnapshotLiability";
CREATE INDEX "SnapshotLiability_snapshotId_idx" ON "SnapshotLiability"("snapshotId");
CREATE INDEX "SnapshotLiability_sourceLiabilityId_idx" ON "SnapshotLiability"("sourceLiabilityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
