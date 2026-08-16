-- CreateEnum
CREATE TYPE "ModerationMeasure" AS ENUM ('COMMENT_REMOVED', 'ACCOUNT_DELETED');

-- CreateEnum
CREATE TYPE "ModerationLegalBasis" AS ENUM ('ILLEGAL_CONTENT', 'TOS_BREACH');

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "measure" "ModerationMeasure" NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "subjectEmail" TEXT NOT NULL,
    "subjectUsername" TEXT NOT NULL,
    "legalBasis" "ModerationLegalBasis" NOT NULL,
    "reasonCategory" "ReportCategory",
    "reasonMotif" "ReportMotif",
    "reasonText" TEXT NOT NULL,
    "tosClause" TEXT NOT NULL,
    "contentSnapshot" TEXT,
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationDecision_subjectUserId_idx" ON "ModerationDecision"("subjectUserId");

-- CreateIndex
CREATE INDEX "ModerationDecision_decidedAt_idx" ON "ModerationDecision"("decidedAt");

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
