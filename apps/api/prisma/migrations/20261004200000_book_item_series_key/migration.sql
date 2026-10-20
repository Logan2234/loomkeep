-- AlterTable
ALTER TABLE "BookItem" ADD COLUMN     "seriesKey" TEXT;

-- CreateIndex
CREATE INDEX "BookItem_seriesKey_idx" ON "BookItem"("seriesKey");
