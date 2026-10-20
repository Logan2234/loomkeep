-- Materialized library progress (PRF-02): every page of the media library
-- used to aggregate Season x Episode x EpisodeWatch over the whole library to
-- rank and filter it. The counts now live on the rows, kept exact by the
-- triggers below rather than by each code path that writes watches or
-- episodes (bulk imports included), so none can be forgotten.

-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN     "episodeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN     "lastWatchedAt" TIMESTAMP(3),
ADD COLUMN     "watchedEpisodes" INTEGER NOT NULL DEFAULT 0;

-- Regular episodes (season > 0) of the media touched by an Episode statement.
CREATE FUNCTION "media_item_sync_episode_count"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "MediaItem" m
  SET "episodeCount" = (
    SELECT COUNT(*)
    FROM "Episode" e
    JOIN "Season" s ON s."id" = e."seasonId"
    WHERE s."mediaItemId" = m."id" AND s."number" > 0
  )
  WHERE m."id" IN (
    SELECT s."mediaItemId"
    FROM changed c
    JOIN "Season" s ON s."id" = c."seasonId"
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER "episode_insert_sync_episode_count"
AFTER INSERT ON "Episode"
REFERENCING NEW TABLE AS changed
FOR EACH STATEMENT EXECUTE FUNCTION "media_item_sync_episode_count"();

CREATE TRIGGER "episode_delete_sync_episode_count"
AFTER DELETE ON "Episode"
REFERENCING OLD TABLE AS changed
FOR EACH STATEMENT EXECUTE FUNCTION "media_item_sync_episode_count"();

-- The library entries whose watches an EpisodeWatch statement touched:
-- distinct regular episodes watched, and the last viewing of any episode
-- (specials included), as LibraryService has always counted them.
CREATE FUNCTION "library_entry_sync_progress"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "LibraryEntry" le
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

CREATE TRIGGER "episode_watch_insert_sync_progress"
AFTER INSERT ON "EpisodeWatch"
REFERENCING NEW TABLE AS changed
FOR EACH STATEMENT EXECUTE FUNCTION "library_entry_sync_progress"();

CREATE TRIGGER "episode_watch_update_sync_progress"
AFTER UPDATE ON "EpisodeWatch"
REFERENCING NEW TABLE AS changed
FOR EACH STATEMENT EXECUTE FUNCTION "library_entry_sync_progress"();

CREATE TRIGGER "episode_watch_delete_sync_progress"
AFTER DELETE ON "EpisodeWatch"
REFERENCING OLD TABLE AS changed
FOR EACH STATEMENT EXECUTE FUNCTION "library_entry_sync_progress"();

-- An entry created over watches that already exist starts from them.
CREATE FUNCTION "library_entry_init_progress"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT
    COUNT(DISTINCT w."episodeId") FILTER (WHERE s."number" > 0),
    MAX(w."watchedAt")
  INTO NEW."watchedEpisodes", NEW."lastWatchedAt"
  FROM "EpisodeWatch" w
  JOIN "Episode" e ON e."id" = w."episodeId"
  JOIN "Season" s ON s."id" = e."seasonId"
  WHERE w."userId" = NEW."userId" AND s."mediaItemId" = NEW."mediaItemId";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "library_entry_insert_init_progress"
BEFORE INSERT ON "LibraryEntry"
FOR EACH ROW EXECUTE FUNCTION "library_entry_init_progress"();

-- Backfill.
UPDATE "MediaItem" m
SET "episodeCount" = counted.total
FROM (
  SELECT s."mediaItemId", COUNT(*) AS total
  FROM "Episode" e
  JOIN "Season" s ON s."id" = e."seasonId"
  WHERE s."number" > 0
  GROUP BY s."mediaItemId"
) counted
WHERE m."id" = counted."mediaItemId";

UPDATE "LibraryEntry" le
SET "watchedEpisodes" = counted.watched,
    "lastWatchedAt" = counted.last
FROM (
  SELECT w."userId", s."mediaItemId",
         COUNT(DISTINCT w."episodeId") FILTER (WHERE s."number" > 0) AS watched,
         MAX(w."watchedAt") AS last
  FROM "EpisodeWatch" w
  JOIN "Episode" e ON e."id" = w."episodeId"
  JOIN "Season" s ON s."id" = e."seasonId"
  GROUP BY w."userId", s."mediaItemId"
) counted
WHERE le."userId" = counted."userId" AND le."mediaItemId" = counted."mediaItemId";
