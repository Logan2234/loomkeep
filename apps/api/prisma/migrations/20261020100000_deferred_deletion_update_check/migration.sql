-- CreateEnum
CREATE TYPE "AccountDeletionReason" AS ENUM ('NOT_USING', 'MISSING_FEATURE', 'OTHER_SERVICE', 'PRIVACY', 'TOO_COMPLEX', 'NEW_ACCOUNT', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionCancelTokenHash" TEXT,
ADD COLUMN     "deletionReason" "AccountDeletionReason",
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NewsletterSend" ADD COLUMN     "contentHtml" TEXT,
ADD COLUMN     "contentPreview" TEXT;

-- AlterTable
ALTER TABLE "InstanceSettings" ADD COLUMN     "updateCheckEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UpdateCheck" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "latestVersion" TEXT,
    "checkedAt" TIMESTAMP(3),
    "lastCheckFailed" BOOLEAN NOT NULL DEFAULT false,
    "notifiedVersion" TEXT,

    CONSTRAINT "UpdateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionFeedback" (
    "id" TEXT NOT NULL,
    "reason" "AccountDeletionReason",
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_deletionCancelTokenHash_key" ON "User"("deletionCancelTokenHash");

-- CreateIndex
CREATE INDEX "AccountDeletionFeedback_deletedAt_idx" ON "AccountDeletionFeedback"("deletedAt");
