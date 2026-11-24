-- Home feed: followed users' homeFeed events, newest first. Replaces the
-- (homeFeed, createdAt) index, which led with a boolean and didn't fit that
-- query; the partial one only holds feed events.
DROP INDEX "ActivityEvent_homeFeed_createdAt_idx";
CREATE INDEX "ActivityEvent_userId_createdAt_homeFeed_idx" ON "ActivityEvent"("userId", "createdAt") WHERE "homeFeed";

-- The daily purge of read notifications: unread rows (readAt null), never
-- purged, no longer take room in the index.
DROP INDEX "Notification_readAt_idx";
CREATE INDEX "Notification_readAt_read_idx" ON "Notification"("readAt") WHERE "readAt" IS NOT NULL;

-- A user's viewings over a period (home stats, streaks).
CREATE INDEX "EpisodeWatch_userId_watchedAt_idx" ON "EpisodeWatch"("userId", "watchedAt");

-- A UTC day, not an instant: the stored values are already midnight UTC.
ALTER TABLE "ApiCallCounter" ALTER COLUMN "day" SET DATA TYPE DATE USING "day"::date;

-- String columns with a closed set of values, as the code writes them.
-- ActivityEvent.type stays open on purpose: new kinds need no migration.
ALTER TABLE "ActivityEvent"
  -- The content Domains plus LISTS (ActivityDomain in packages/shared).
  ADD CONSTRAINT "ActivityEvent_domain_check" CHECK (
    "domain" IN ('MEDIA', 'BOOKS', 'GAMES', 'MUSIC', 'PODCASTS', 'BOARDGAMES', 'LISTS')
  ),
  ADD CONSTRAINT "ActivityEvent_level_check" CHECK ("level" IN ('WORK', 'SEASON', 'EPISODE'));
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_status_check" CHECK ("status" IN ('SUCCESS', 'FAILURE'));
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_status_check" CHECK ("status" IN ('SUCCESS', 'FAILURE'));
-- SimpleWebAuthn's CredentialDeviceType.
ALTER TABLE "WebauthnCredential" ADD CONSTRAINT "WebauthnCredential_deviceType_check"
  CHECK ("deviceType" IN ('singleDevice', 'multiDevice'));
