CREATE TYPE "UserActionTokenType" AS ENUM ('TELEGRAM_BINDING', 'ACCOUNT_ACTIVATION', 'PASSWORD_RESET');

CREATE TABLE "UserActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenType" "UserActionTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserActionToken_tokenHash_key" ON "UserActionToken"("tokenHash");
CREATE UNIQUE INDEX "UserActionToken_userId_tokenType_active_key" ON "UserActionToken"("userId", "tokenType")
WHERE "consumedAt" IS NULL AND "invalidatedAt" IS NULL;
CREATE INDEX "UserActionToken_userId_tokenType_createdAt_idx" ON "UserActionToken"("userId", "tokenType", "createdAt" DESC);
CREATE INDEX "UserActionToken_expiresAt_idx" ON "UserActionToken"("expiresAt");

ALTER TABLE "UserActionToken"
ADD CONSTRAINT "UserActionToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
