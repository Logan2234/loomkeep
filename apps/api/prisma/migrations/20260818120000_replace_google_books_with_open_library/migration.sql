-- Google Books is replaced by Open Library as the sole book catalogue source.
-- Every cached book was keyed by a Google Books volume id, so the cache is
-- dropped rather than converted: BookItem is an on-demand cache that rebuilds
-- itself the next time a user references a book.

-- 1. Moderation rows pointing at a review/comment that is about to disappear.
--    Report/ModerationDecision target a COMMENT or a REVIEW (never a BOOK
--    directly), so they are resolved through those before the deletes below.
DELETE FROM "ModerationDecision"
WHERE "targetType" = 'COMMENT'
  AND "targetId" IN (SELECT "id" FROM "Comment" WHERE "targetType" = 'BOOK');

DELETE FROM "Report"
WHERE ("targetType" = 'COMMENT'
       AND "targetId" IN (SELECT "id" FROM "Comment" WHERE "targetType" = 'BOOK'))
   OR ("targetType" = 'REVIEW'
       AND "targetId" IN (SELECT "id" FROM "Review" WHERE "targetType" = 'BOOK'));

-- 2. Polymorphic (FK-less) references to a cached book: nothing cascades here,
--    they have to go explicitly. Comment replies/reactions and review votes do
--    cascade from their own parent row.
DELETE FROM "Review" WHERE "targetType" = 'BOOK';
DELETE FROM "Comment" WHERE "targetType" = 'BOOK';
DELETE FROM "ListItem" WHERE "targetType" = 'BOOK';
DELETE FROM "ActivityEvent" WHERE "targetType" = 'BOOK';
DELETE FROM "Notification" WHERE "url" LIKE '/app/books/%';

-- 3. The cache itself. BookExternalId and BookEntry cascade from BookItem,
--    BookReplay from BookEntry. ReadingGoal is untouched: it references no book.
DELETE FROM "BookItem";

-- 4. Daily call counters for the retired provider (both the key the tracker
--    wrote and the mismatched one the seed used).
DELETE FROM "ApiCallCounter" WHERE "provider" IN ('googleBooks', 'google_books');

-- 5. Swap the enum value, now that no row carries the old one.
ALTER TYPE "BookSource" RENAME TO "BookSource_old";
CREATE TYPE "BookSource" AS ENUM ('OPEN_LIBRARY');
ALTER TABLE "BookItem" ALTER COLUMN "canonicalSource" TYPE "BookSource" USING ("canonicalSource"::text::"BookSource");
ALTER TABLE "BookExternalId" ALTER COLUMN "source" TYPE "BookSource" USING ("source"::text::"BookSource");
DROP TYPE "BookSource_old";
