-- DropIndex
DROP INDEX "SecurityEvent_userId_idx";

-- AlterTable
ALTER TABLE "SecurityEvent" ADD COLUMN     "ip" TEXT;

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");

-- NEW_DEVICE_LOGIN used to carry its IP as free text in `detail`.
UPDATE "SecurityEvent"
SET "ip" = substring("detail" FROM 5), "detail" = NULL
WHERE "type" = 'NEW_DEVICE_LOGIN' AND "detail" LIKE 'IP: %';
