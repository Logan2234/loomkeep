-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "readAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationsSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- Older bell rows lack the structured data the bell now renders from (their
-- wording was persisted as a phrase): the bell starts empty instead.
-- Release rows stay: the hourly scan would recreate (and send again) any of
-- the last 14 days' releases whose row went missing.
DELETE FROM "Notification" WHERE "type" NOT IN ('NEW_EPISODE', 'NEW_MOVIE', 'NEW_GAME');
