-- AlterTable
ALTER TABLE "UserUrlToken" ADD COLUMN "arrToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserUrlToken_arrToken_key" ON "UserUrlToken"("arrToken");
