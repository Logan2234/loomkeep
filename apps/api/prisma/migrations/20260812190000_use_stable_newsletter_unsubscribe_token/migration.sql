-- AlterTable
ALTER TABLE "User" ADD COLUMN     "newsletterUnsubscribeToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_newsletterUnsubscribeToken_key" ON "User"("newsletterUnsubscribeToken");
