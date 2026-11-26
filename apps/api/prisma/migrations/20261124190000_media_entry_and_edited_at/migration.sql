-- LibraryEntry becomes MediaEntry, like GameEntry, BookEntry and MusicEntry.
-- Renames only touch the catalog: no row is rewritten. Constraints and
-- indexes follow the names Prisma derives from the new table and columns.
ALTER TABLE "LibraryEntry" RENAME TO "MediaEntry";
ALTER TABLE "MediaEntry" RENAME CONSTRAINT "LibraryEntry_pkey" TO "MediaEntry_pkey";
ALTER TABLE "MediaEntry" RENAME CONSTRAINT "LibraryEntry_userId_fkey" TO "MediaEntry_userId_fkey";
ALTER TABLE "MediaEntry" RENAME CONSTRAINT "LibraryEntry_mediaItemId_fkey" TO "MediaEntry_mediaItemId_fkey";
ALTER TABLE "MediaEntry" RENAME CONSTRAINT "LibraryEntry_ownershipSource_check" TO "MediaEntry_ownershipSource_check";
ALTER TABLE "MediaEntry" RENAME CONSTRAINT "LibraryEntry_ownershipStatus_check" TO "MediaEntry_ownershipStatus_check";
ALTER INDEX "LibraryEntry_userId_mediaItemId_key" RENAME TO "MediaEntry_userId_mediaItemId_key";
ALTER INDEX "LibraryEntry_mediaItemId_idx" RENAME TO "MediaEntry_mediaItemId_idx";

ALTER TABLE "MovieReplay" RENAME COLUMN "libraryEntryId" TO "mediaEntryId";
ALTER TABLE "MovieReplay" RENAME CONSTRAINT "MovieReplay_libraryEntryId_fkey" TO "MovieReplay_mediaEntryId_fkey";
ALTER INDEX "MovieReplay_libraryEntryId_idx" RENAME TO "MovieReplay_mediaEntryId_idx";

-- Loan_entry_check follows the column rename on its own.
ALTER TABLE "Loan" RENAME COLUMN "libraryEntryId" TO "mediaEntryId";
ALTER TABLE "Loan" RENAME CONSTRAINT "Loan_libraryEntryId_fkey" TO "Loan_mediaEntryId_fkey";
ALTER INDEX "Loan_libraryEntryId_idx" RENAME TO "Loan_mediaEntryId_idx";
ALTER INDEX "Loan_libraryEntryId_open_key" RENAME TO "Loan_mediaEntryId_open_key";

-- The progress triggers (20261019160000_materialized_library_progress) name
-- the table in their bodies: same logic, new name. Renaming a function keeps
-- the triggers bound to it.
ALTER FUNCTION "library_entry_sync_progress"() RENAME TO "media_entry_sync_progress";
ALTER FUNCTION "library_entry_init_progress"() RENAME TO "media_entry_init_progress";
ALTER TRIGGER "library_entry_insert_init_progress" ON "MediaEntry" RENAME TO "media_entry_insert_init_progress";

CREATE OR REPLACE FUNCTION "media_entry_sync_progress"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "MediaEntry" le
  SET "watchedEpisodes" = (
        SELECT COUNT(DISTINCT w."episodeId")
        FROM "EpisodeWatch" w
        JOIN "Episode" e ON e."id" = w."episodeId"
        JOIN "Season" s ON s."id" = e."seasonId"
        WHERE w."userId" = le."userId"
          AND s."mediaItemId" = le."mediaItemId"
          AND s."number" > 0
      ),
      "lastWatchedAt" = (
        SELECT MAX(w."watchedAt")
        FROM "EpisodeWatch" w
        JOIN "Episode" e ON e."id" = w."episodeId"
        JOIN "Season" s ON s."id" = e."seasonId"
        WHERE w."userId" = le."userId" AND s."mediaItemId" = le."mediaItemId"
      )
  FROM (
    SELECT DISTINCT c."userId", s."mediaItemId"
    FROM changed c
    JOIN "Episode" e ON e."id" = c."episodeId"
    JOIN "Season" s ON s."id" = e."seasonId"
  ) touched
  WHERE le."userId" = touched."userId"
    AND le."mediaItemId" = touched."mediaItemId";
  RETURN NULL;
END;
$$;

-- XP gained from a media entry is stored by table name.
UPDATE "XpEntry" SET "sourceType" = 'MediaEntry' WHERE "sourceType" = 'LibraryEntry';

-- Comments and messages keep when they were last edited instead of a flag.
-- Rows edited before have no exact time: their updatedAt is the best known.
ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);
UPDATE "Comment" SET "editedAt" = "updatedAt" WHERE "edited";
ALTER TABLE "Comment" DROP COLUMN "edited";

ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);
UPDATE "Message" SET "editedAt" = "updatedAt" WHERE "edited";
ALTER TABLE "Message" DROP COLUMN "edited";
