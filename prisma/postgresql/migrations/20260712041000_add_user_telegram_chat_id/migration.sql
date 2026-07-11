ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;

CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");
