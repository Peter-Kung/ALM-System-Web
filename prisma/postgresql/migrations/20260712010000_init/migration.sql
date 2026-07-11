-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'BROKERAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF', 'FUND', 'CASH_EQUIVALENT', 'REAL_ESTATE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetPriceSourceType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('MORTGAGE', 'PERSONAL_LOAN', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceRecordSourceType" AS ENUM ('AUTO_REFRESH', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "SnapshotIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "SnapshotIssueType" AS ENUM ('MISSING_PRICE', 'MISSING_FX_RATE', 'INVALID_PRICE', 'INVALID_BALANCE', 'DATA_GAP', 'OTHER');

-- CreateEnum
CREATE TYPE "SnapshotEntityType" AS ENUM ('ACCOUNT', 'ASSET', 'HOLDING', 'LIABILITY', 'PRICE_RECORD', 'SNAPSHOT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "bootstrapKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL,
    "cashBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "symbol" TEXT,
    "currency" TEXT NOT NULL,
    "priceSourceType" "AssetPriceSourceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "liabilityType" "LiabilityType" NOT NULL,
    "currency" TEXT NOT NULL,
    "originalAmount" DECIMAL(65,30) NOT NULL,
    "currentBalance" DECIMAL(65,30) NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "monthlyPayment" DECIMAL(65,30) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "paymentAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceType" "PriceRecordSourceType" NOT NULL,
    "currency" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previewHash" TEXT,
    "status" "SnapshotStatus" NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "totalAssets" DECIMAL(65,30) NOT NULL,
    "totalLiabilities" DECIMAL(65,30) NOT NULL,
    "netWorth" DECIMAL(65,30) NOT NULL,
    "cashPosition" DECIMAL(65,30) NOT NULL,
    "investmentValue" DECIMAL(65,30) NOT NULL,
    "monthlyDebtPaymentTotal" DECIMAL(65,30) NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotAccount" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sourceAccountId" TEXT,
    "accountName" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL,
    "cashBalance" DECIMAL(65,30) NOT NULL,
    "holdingsValue" DECIMAL(65,30) NOT NULL,
    "totalValue" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SnapshotAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotHolding" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sourceHoldingId" TEXT,
    "sourceAccountId" TEXT,
    "sourceAssetId" TEXT,
    "accountName" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "symbol" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "assetCurrency" TEXT NOT NULL,
    "priceAmount" DECIMAL(65,30),
    "priceCurrency" TEXT,
    "priceRecordedAt" TIMESTAMP(3),
    "fxRateToBase" DECIMAL(65,30),
    "marketValue" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SnapshotHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotLiability" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sourceLiabilityId" TEXT,
    "liabilityName" TEXT NOT NULL,
    "liabilityType" "LiabilityType" NOT NULL,
    "currency" TEXT NOT NULL,
    "currentBalance" DECIMAL(65,30) NOT NULL,
    "monthlyPayment" DECIMAL(65,30) NOT NULL,
    "fxRateToBase" DECIMAL(65,30),
    "balanceValue" DECIMAL(65,30) NOT NULL,
    "monthlyPaymentValue" DECIMAL(65,30) NOT NULL,
    "paymentAccountName" TEXT,

    CONSTRAINT "SnapshotLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotIssue" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "severity" "SnapshotIssueSeverity" NOT NULL,
    "issueType" "SnapshotIssueType" NOT NULL,
    "affectedEntityType" "SnapshotEntityType" NOT NULL,
    "affectedEntityId" TEXT,
    "message" TEXT NOT NULL,

    CONSTRAINT "SnapshotIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_bootstrapKey_key" ON "User"("bootstrapKey");

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
CREATE UNIQUE INDEX "Snapshot_userId_previewHash_key" ON "Snapshot"("userId", "previewHash");

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

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRecord" ADD CONSTRAINT "PriceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotAccount" ADD CONSTRAINT "SnapshotAccount_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotHolding" ADD CONSTRAINT "SnapshotHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotLiability" ADD CONSTRAINT "SnapshotLiability_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotIssue" ADD CONSTRAINT "SnapshotIssue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

