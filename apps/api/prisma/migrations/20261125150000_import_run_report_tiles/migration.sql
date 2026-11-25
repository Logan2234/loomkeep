-- The import report's figures, which the web labels in the reader's language
-- instead of the English text `summary` held.
ALTER TABLE "ImportRun" ADD COLUMN "reportTiles" JSONB;

-- Runs recorded with their details already carry the tiles.
UPDATE "ImportRun"
SET "reportTiles" = "details" -> 'report' -> 'tiles'
WHERE jsonb_typeof("details" -> 'report' -> 'tiles') = 'array';
