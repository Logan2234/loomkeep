CREATE TYPE "TrackingCycleStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');
CREATE TYPE "SessionCycleAction" AS ENUM ('CONTINUE', 'RESTART', 'HISTORY_ONLY');

CREATE TABLE "GamePlaythrough" (
    "id" TEXT NOT NULL,
    "gameEntryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "TrackingCycleStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "trackedMinutes" INTEGER NOT NULL DEFAULT 0,
    "legacyIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GamePlaythrough_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookReading" (
    "id" TEXT NOT NULL,
    "bookEntryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "TrackingCycleStatus" NOT NULL,
    "editionKey" TEXT,
    "referencePageCount" INTEGER,
    "baselinePage" INTEGER NOT NULL DEFAULT 0,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "trackedMinutes" INTEGER NOT NULL DEFAULT 0,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "legacyIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookReading_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GameSession" ADD COLUMN "playthroughId" TEXT;
ALTER TABLE "BookSession" ADD COLUMN "readingId" TEXT;
ALTER TABLE "SessionTimer" ADD COLUMN "cycleAction" "SessionCycleAction";

CREATE UNIQUE INDEX "GamePlaythrough_gameEntryId_number_key" ON "GamePlaythrough"("gameEntryId", "number");
CREATE INDEX "GamePlaythrough_gameEntryId_status_idx" ON "GamePlaythrough"("gameEntryId", "status");
CREATE UNIQUE INDEX "GamePlaythrough_one_active_idx" ON "GamePlaythrough"("gameEntryId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "BookReading_bookEntryId_number_key" ON "BookReading"("bookEntryId", "number");
CREATE INDEX "BookReading_bookEntryId_status_idx" ON "BookReading"("bookEntryId", "status");
CREATE UNIQUE INDEX "BookReading_one_active_idx" ON "BookReading"("bookEntryId") WHERE "status" = 'ACTIVE';
CREATE INDEX "GameSession_playthroughId_occurredAt_idx" ON "GameSession"("playthroughId", "occurredAt");
CREATE INDEX "BookSession_readingId_occurredAt_idx" ON "BookSession"("readingId", "occurredAt");

ALTER TABLE "GamePlaythrough" ADD CONSTRAINT "GamePlaythrough_gameEntryId_fkey" FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookReading" ADD CONSTRAINT "BookReading_bookEntryId_fkey" FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_playthroughId_fkey" FOREIGN KEY ("playthroughId") REFERENCES "GamePlaythrough"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookSession" ADD CONSTRAINT "BookSession_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "BookReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "GamePlaythrough" (
    "id", "gameEntryId", "number", "status", "startedAt", "finishedAt",
    "trackedMinutes", "legacyIncomplete", "createdAt", "updatedAt"
)
SELECT
    'gp_' || md5('base:' || entry."id"),
    entry."id",
    1,
    CASE entry."status"
      WHEN 'COMPLETED' THEN 'COMPLETED'::"TrackingCycleStatus"
      WHEN 'DROPPED' THEN 'DROPPED'::"TrackingCycleStatus"
      ELSE 'ACTIVE'::"TrackingCycleStatus"
    END,
    COALESCE(entry."startedAt", MIN(session."occurredAt")),
    CASE WHEN entry."status" = 'COMPLETED' THEN entry."finishedAt" ELSE NULL END,
    COALESCE(SUM(session."durationMinutes"), 0),
    COUNT(session."id") = 0,
    entry."createdAt",
    CURRENT_TIMESTAMP
FROM "GameEntry" entry
LEFT JOIN "GameSession" session ON session."gameEntryId" = entry."id"
WHERE entry."status" <> 'BACKLOG'
   OR entry."finishedAt" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "GameSession" existing WHERE existing."gameEntryId" = entry."id")
GROUP BY entry."id";

UPDATE "GameSession" session
SET "playthroughId" = 'gp_' || md5('base:' || session."gameEntryId")
WHERE EXISTS (
    SELECT 1 FROM "GamePlaythrough" playthrough
    WHERE playthrough."id" = 'gp_' || md5('base:' || session."gameEntryId")
);

INSERT INTO "GamePlaythrough" (
    "id", "gameEntryId", "number", "status", "startedAt", "finishedAt",
    "trackedMinutes", "legacyIncomplete", "createdAt", "updatedAt"
)
SELECT
    'gp_' || md5('replay:' || replay."id"),
    replay."gameEntryId",
    (ROW_NUMBER() OVER (PARTITION BY replay."gameEntryId" ORDER BY replay."finishedAt", replay."id") +
      CASE WHEN EXISTS (
        SELECT 1 FROM "GamePlaythrough" base
        WHERE base."gameEntryId" = replay."gameEntryId" AND base."number" = 1
      ) THEN 1 ELSE 0 END)::integer,
    'COMPLETED'::"TrackingCycleStatus",
    NULL,
    replay."finishedAt",
    0,
    true,
    replay."finishedAt",
    replay."finishedAt"
FROM "GameReplay" replay;

INSERT INTO "BookReading" (
    "id", "bookEntryId", "number", "status", "editionKey",
    "referencePageCount", "baselinePage", "currentPage", "trackedMinutes", "pagesRead", "startedAt",
    "finishedAt", "legacyIncomplete", "createdAt", "updatedAt"
)
SELECT
    'br_' || md5('base:' || entry."id"),
    entry."id",
    1,
    CASE entry."status"
      WHEN 'READ' THEN 'COMPLETED'::"TrackingCycleStatus"
      WHEN 'DROPPED' THEN 'DROPPED'::"TrackingCycleStatus"
      ELSE 'ACTIVE'::"TrackingCycleStatus"
    END,
    entry."editionKey",
    entry."referencePageCount",
    entry."readingBaselinePage",
    entry."currentPage",
    COALESCE(SUM(session."durationMinutes"), 0),
    COALESCE(SUM(session."pagesRead"), 0),
    COALESCE(entry."startedAt", MIN(session."occurredAt")),
    CASE WHEN entry."status" = 'READ' THEN entry."finishedAt" ELSE NULL END,
    COUNT(session."id") = 0,
    entry."createdAt",
    CURRENT_TIMESTAMP
FROM "BookEntry" entry
LEFT JOIN "BookSession" session ON session."bookEntryId" = entry."id"
WHERE entry."status" <> 'TO_READ'
   OR entry."finishedAt" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "BookSession" existing WHERE existing."bookEntryId" = entry."id")
GROUP BY entry."id";

UPDATE "BookSession" session
SET "readingId" = 'br_' || md5('base:' || session."bookEntryId")
WHERE EXISTS (
    SELECT 1 FROM "BookReading" reading
    WHERE reading."id" = 'br_' || md5('base:' || session."bookEntryId")
);

INSERT INTO "BookReading" (
    "id", "bookEntryId", "number", "status", "editionKey",
    "referencePageCount", "baselinePage", "currentPage", "trackedMinutes", "pagesRead", "startedAt",
    "finishedAt", "legacyIncomplete", "createdAt", "updatedAt"
)
SELECT
    'br_' || md5('replay:' || replay."id"),
    replay."bookEntryId",
    (ROW_NUMBER() OVER (PARTITION BY replay."bookEntryId" ORDER BY replay."finishedAt", replay."id") +
      CASE WHEN EXISTS (
        SELECT 1 FROM "BookReading" base
        WHERE base."bookEntryId" = replay."bookEntryId" AND base."number" = 1
      ) THEN 1 ELSE 0 END)::integer,
    'COMPLETED'::"TrackingCycleStatus",
    NULL,
    NULL,
    0,
    0,
    0,
    0,
    NULL,
    replay."finishedAt",
    true,
    replay."finishedAt",
    replay."finishedAt"
FROM "BookReplay" replay;

UPDATE "SessionTimer" timer
SET "cycleAction" = CASE
  WHEN NOT timer."resumeTracking" THEN NULL
  WHEN timer."domain" = 'GAMES' AND EXISTS (
    SELECT 1 FROM "GameEntry" entry
    WHERE entry."id" = timer."gameEntryId" AND entry."status" = 'COMPLETED'
  ) THEN 'RESTART'::"SessionCycleAction"
  WHEN timer."domain" = 'BOOKS' AND EXISTS (
    SELECT 1 FROM "BookEntry" entry
    WHERE entry."id" = timer."bookEntryId" AND entry."status" = 'READ'
  ) THEN 'RESTART'::"SessionCycleAction"
  ELSE 'CONTINUE'::"SessionCycleAction"
END;

UPDATE "XpEntry"
SET "sourceType" = 'GamePlaythrough',
    "sourceId" = 'gp_' || md5('base:' || "sourceId")
WHERE "reason" = 'GAME_FINISHED' AND "sourceType" = 'GameEntry';

UPDATE "XpEntry"
SET "sourceType" = 'GamePlaythrough',
    "sourceId" = 'gp_' || md5('replay:' || "sourceId")
WHERE "reason" = 'GAME_REPLAYED' AND "sourceType" = 'GameReplay';

UPDATE "XpEntry"
SET "sourceType" = 'BookReading',
    "sourceId" = 'br_' || md5('base:' || "sourceId")
WHERE "reason" = 'BOOK_FINISHED' AND "sourceType" = 'BookEntry';

UPDATE "XpEntry"
SET "sourceType" = 'BookReading',
    "sourceId" = 'br_' || md5('replay:' || "sourceId")
WHERE "reason" = 'BOOK_REPLAYED' AND "sourceType" = 'BookReplay';

ALTER TABLE "SessionTimer" DROP COLUMN "resumeTracking";
DROP TABLE "GameReplay";
DROP TABLE "BookReplay";
