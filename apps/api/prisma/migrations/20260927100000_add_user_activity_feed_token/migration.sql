-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activityFeedToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_activityFeedToken_key" ON "User"("activityFeedToken");
