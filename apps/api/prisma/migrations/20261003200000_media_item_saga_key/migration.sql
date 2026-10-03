-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN     "sagaKey" TEXT;

-- CreateIndex
CREATE INDEX "MediaItem_sagaKey_idx" ON "MediaItem"("sagaKey");
