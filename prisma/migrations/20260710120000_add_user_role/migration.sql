ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "User" ADD COLUMN "bootstrapKey" TEXT;
CREATE UNIQUE INDEX "User_bootstrapKey_key" ON "User"("bootstrapKey");
