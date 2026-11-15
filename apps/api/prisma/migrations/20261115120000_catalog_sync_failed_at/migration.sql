-- A failed background refresh is stamped here instead of leaving the item
-- at the head of the stalest-first queue for good.

-- AlterTable
ALTER TABLE "BookItem" ADD COLUMN     "syncFailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GameItem" ADD COLUMN     "syncFailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN     "syncFailedAt" TIMESTAMP(3);
