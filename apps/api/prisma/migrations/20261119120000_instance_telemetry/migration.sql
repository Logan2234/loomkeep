-- AlterTable
ALTER TABLE "InstanceSettings" ADD COLUMN     "telemetryEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "UpdateCheck" ADD COLUMN     "instanceId" TEXT;

-- CreateTable
CREATE TABLE "InstancePing" (
    "instanceId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstancePing_pkey" PRIMARY KEY ("instanceId")
);

-- CreateIndex
CREATE INDEX "InstancePing_lastSeenAt_idx" ON "InstancePing"("lastSeenAt");
