-- The nightly XP reconciliation reads live rows reason by reason: revoked
-- rows, kept for the history, no longer sit in its index.
DROP INDEX "XpEntry_reason_id_idx";
CREATE INDEX "XpEntry_reason_id_live_idx" ON "XpEntry"("reason", "id") WHERE "revokedAt" IS NULL;

-- The nightly subject backfill reads live rows without a title, source type by
-- source type: without this, six full scans of the ledger each night.
CREATE INDEX "XpEntry_sourceType_id_missing_subject_idx" ON "XpEntry"("sourceType", "id") WHERE "revokedAt" IS NULL AND "title" IS NULL;

-- The daily purge of release notifications past their retention, across
-- every account.
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
