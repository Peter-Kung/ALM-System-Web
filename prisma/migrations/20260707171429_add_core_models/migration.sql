-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "cashBalance" DECIMAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "symbol" TEXT,
    "currency" TEXT NOT NULL,
    "priceSourceType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Holding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "liabilityType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "originalAmount" DECIMAL NOT NULL,
    "currentBalance" DECIMAL NOT NULL,
    "interestRate" DECIMAL NOT NULL,
    "monthlyPayment" DECIMAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "paymentAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Liability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Liability_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "SnapshotAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "sourceAccountId" TEXT,
    "accountName" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "cashBalance" DECIMAL NOT NULL,
    "holdingsValue" DECIMAL NOT NULL,
    "totalValue" DECIMAL NOT NULL,
    CONSTRAINT "SnapshotAccount_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotHolding" (
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
    "priceAmount" DECIMAL NOT NULL,
    "priceCurrency" TEXT NOT NULL,
    "fxRateToBase" DECIMAL NOT NULL,
    "marketValue" DECIMAL NOT NULL,
    CONSTRAINT "SnapshotHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotLiability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "sourceLiabilityId" TEXT,
    "liabilityName" TEXT NOT NULL,
    "liabilityType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "currentBalance" DECIMAL NOT NULL,
    "monthlyPayment" DECIMAL NOT NULL,
    "fxRateToBase" DECIMAL NOT NULL,
    "balanceValue" DECIMAL NOT NULL,
    "monthlyPaymentValue" DECIMAL NOT NULL,
    "paymentAccountName" TEXT,
    CONSTRAINT "SnapshotLiability_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "affectedEntityType" TEXT NOT NULL,
    "affectedEntityId" TEXT,
    "message" TEXT NOT NULL,
    CONSTRAINT "SnapshotIssue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Account_userId_accountType_idx" ON "Account"("userId", "accountType");

-- CreateIndex
CREATE INDEX "Asset_userId_assetType_idx" ON "Asset"("userId", "assetType");

-- CreateIndex
CREATE INDEX "Asset_symbol_idx" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Holding_assetId_idx" ON "Holding"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_assetId_key" ON "Holding"("accountId", "assetId");

-- CreateIndex
CREATE INDEX "Liability_userId_liabilityType_idx" ON "Liability"("userId", "liabilityType");

-- CreateIndex
CREATE INDEX "Liability_paymentAccountId_idx" ON "Liability"("paymentAccountId");

-- CreateIndex
CREATE INDEX "PriceRecord_assetId_recordedAt_idx" ON "PriceRecord"("assetId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "Snapshot_userId_snapshotAt_idx" ON "Snapshot"("userId", "snapshotAt" DESC);

-- CreateIndex
CREATE INDEX "SnapshotAccount_snapshotId_idx" ON "SnapshotAccount"("snapshotId");

-- CreateIndex
CREATE INDEX "SnapshotAccount_sourceAccountId_idx" ON "SnapshotAccount"("sourceAccountId");

-- CreateIndex
CREATE INDEX "SnapshotHolding_snapshotId_idx" ON "SnapshotHolding"("snapshotId");

-- CreateIndex
CREATE INDEX "SnapshotHolding_sourceHoldingId_idx" ON "SnapshotHolding"("sourceHoldingId");

-- CreateIndex
CREATE INDEX "SnapshotLiability_snapshotId_idx" ON "SnapshotLiability"("snapshotId");

-- CreateIndex
CREATE INDEX "SnapshotLiability_sourceLiabilityId_idx" ON "SnapshotLiability"("sourceLiabilityId");

-- CreateIndex
CREATE INDEX "SnapshotIssue_snapshotId_severity_idx" ON "SnapshotIssue"("snapshotId", "severity");
