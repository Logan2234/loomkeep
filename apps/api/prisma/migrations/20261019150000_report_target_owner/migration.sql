-- Who the reported content belongs to, kept once the content is gone (SEC-04).
-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "targetOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "Report_targetOwnerId_idx" ON "Report"("targetOwnerId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetOwnerId_fkey" FOREIGN KEY ("targetOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from the content that still exists.
UPDATE "Report" r SET "targetOwnerId" = c."authorId"
  FROM "Comment" c WHERE r."targetType" = 'COMMENT' AND c."id" = r."targetId";
UPDATE "Report" r SET "targetOwnerId" = m."authorId"
  FROM "Message" m WHERE r."targetType" = 'MESSAGE' AND m."id" = r."targetId";
UPDATE "Report" r SET "targetOwnerId" = v."userId"
  FROM "Review" v WHERE r."targetType" = 'REVIEW' AND v."id" = r."targetId";
UPDATE "Report" r SET "targetOwnerId" = l."userId"
  FROM "List" l WHERE r."targetType" = 'LIST' AND l."id" = r."targetId";
UPDATE "Report" r SET "targetOwnerId" = u."id"
  FROM "User" u WHERE r."targetType" = 'USER' AND u."id" = r."targetId";
