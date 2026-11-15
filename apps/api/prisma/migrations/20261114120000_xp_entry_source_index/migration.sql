-- XpService.revokeBySource now filters on (userId, sourceType, sourceId):
-- without this index every revocation scanned the whole XP ledger.

-- CreateIndex
CREATE INDEX "XpEntry_userId_sourceType_sourceId_idx" ON "XpEntry"("userId", "sourceType", "sourceId");
