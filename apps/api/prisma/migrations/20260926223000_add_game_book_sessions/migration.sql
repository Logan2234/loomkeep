-- Session source is shared by game and book session histories.
CREATE TYPE "SessionSource" AS ENUM ('MANUAL', 'TIMER', 'IMPORT');

ALTER TABLE "ActivityEvent"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT;

CREATE INDEX "ActivityEvent_sourceType_sourceId_idx"
ON "ActivityEvent"("sourceType", "sourceId");

ALTER TABLE "GameEntry"
ADD COLUMN "trackedPlaytimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "steamPlaytimeMinutes" INTEGER,
ADD COLUMN "steamSyncedAt" TIMESTAMP(3);

UPDATE "GameEntry"
SET
  "steamPlaytimeMinutes" = "playtimeMinutes",
  "steamSyncedAt" = "updatedAt"
WHERE "ownershipStatus" = 'DIGITAL'
  AND LOWER(COALESCE("ownershipSource", '')) = 'steam';

CREATE TABLE "GameSession" (
  "id" TEXT NOT NULL,
  "gameEntryId" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "source" "SessionSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameSession_gameEntryId_occurredAt_idx"
ON "GameSession"("gameEntryId", "occurredAt");
CREATE INDEX "GameSession_createdAt_idx" ON "GameSession"("createdAt");
ALTER TABLE "GameSession"
ADD CONSTRAINT "GameSession_gameEntryId_fkey"
FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookEntry"
ADD COLUMN "editionKey" TEXT,
ADD COLUMN "referencePageCount" INTEGER,
ADD COLUMN "readingBaselinePage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "trackedReadingMinutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "BookEntry"
SET
  "readingBaselinePage" = "currentPage",
  "referencePageCount" = "BookItem"."pageCount"
FROM "BookItem"
WHERE "BookEntry"."bookItemId" = "BookItem"."id";

CREATE TABLE "BookSession" (
  "id" TEXT NOT NULL,
  "bookEntryId" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "pagesRead" INTEGER NOT NULL,
  "startPage" INTEGER,
  "endPage" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "source" "SessionSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookSession_bookEntryId_occurredAt_idx"
ON "BookSession"("bookEntryId", "occurredAt");
CREATE INDEX "BookSession_createdAt_idx" ON "BookSession"("createdAt");
ALTER TABLE "BookSession"
ADD CONSTRAINT "BookSession_bookEntryId_fkey"
FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
