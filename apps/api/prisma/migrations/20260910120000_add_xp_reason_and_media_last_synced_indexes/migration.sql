-- CreateIndex
CREATE INDEX "XpEntry_reason_id_idx" ON "XpEntry"("reason", "id");

-- CreateIndex
CREATE INDEX "MediaItem_lastSyncedAt_idx" ON "MediaItem"("lastSyncedAt");
