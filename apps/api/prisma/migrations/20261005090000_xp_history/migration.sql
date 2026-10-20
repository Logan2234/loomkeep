-- AlterTable
ALTER TABLE "XpEntry" ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "href" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;

-- A revoked entry is now kept (stamped revokedAt) instead of deleted, so the
-- idempotence key only holds among live rows: re-crediting a revoked source
-- must create a fresh row. Prisma's @@unique cannot carry the WHERE.
DROP INDEX "XpEntry_userId_reason_sourceType_sourceId_key";
CREATE UNIQUE INDEX "XpEntry_live_source_key" ON "XpEntry"("userId", "reason", "sourceType", "sourceId") WHERE "revokedAt" IS NULL;

-- CreateIndex
CREATE INDEX "XpEntry_userId_revokedAt_idx" ON "XpEntry"("userId", "revokedAt");
