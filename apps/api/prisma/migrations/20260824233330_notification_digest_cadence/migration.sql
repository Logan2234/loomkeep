-- CreateEnum
CREATE TYPE "DigestCadence" AS ENUM ('DISABLED', 'WEEKLY', 'DAILY');

-- AlterTable: notifyEmail/notifyPush move from Boolean to DigestCadence.
-- Preserves intent: the current behaviour (send as soon as detected) is
-- closest to DAILY; off stays DISABLED. A non-premium account landing on
-- DAILY is served at the effective WEEKLY cadence at send time instead of
-- losing content (see NotificationDigestService.resolveEffectiveCadence).
ALTER TABLE "User"
  ALTER COLUMN "notifyEmail" DROP DEFAULT,
  ALTER COLUMN "notifyEmail" TYPE "DigestCadence" USING (
    CASE WHEN "notifyEmail" THEN 'DAILY' ELSE 'DISABLED' END::"DigestCadence"
  ),
  ALTER COLUMN "notifyEmail" SET DEFAULT 'WEEKLY',
  ALTER COLUMN "notifyPush" DROP DEFAULT,
  ALTER COLUMN "notifyPush" TYPE "DigestCadence" USING (
    CASE WHEN "notifyPush" THEN 'DAILY' ELSE 'DISABLED' END::"DigestCadence"
  ),
  ALTER COLUMN "notifyPush" SET DEFAULT 'WEEKLY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';

-- AlterTable
ALTER TABLE "Notification"
  ADD COLUMN "emailDigestedAt" TIMESTAMP(3),
  ADD COLUMN "pushDigestedAt" TIMESTAMP(3);
