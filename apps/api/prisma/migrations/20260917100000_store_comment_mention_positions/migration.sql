-- A user can be deliberately mentioned more than once in one comment. The
-- position is the stable identity of the rendered reference, so raw text with
-- the same @handle is never accidentally linked.
ALTER TABLE "CommentMention" ADD COLUMN "start" INTEGER;

WITH positioned_mentions AS (
  SELECT
    mention."commentId",
    mention."userId",
    CASE
      WHEN strpos(comment."text", '@' || mentioned."username") > 0
        THEN strpos(comment."text", '@' || mentioned."username") - 1
      -- A legacy row can survive after its text was edited outside the
      -- composer. Keep it rather than making the migration fail; it will not
      -- render as a mention because the text no longer contains its token.
      ELSE 1000000 + row_number() OVER (PARTITION BY mention."commentId" ORDER BY mention."userId")
    END AS "start"
  FROM "CommentMention" AS mention
  INNER JOIN "Comment" AS comment ON comment."id" = mention."commentId"
  INNER JOIN "User" AS mentioned ON mentioned."id" = mention."userId"
)
UPDATE "CommentMention" AS mention
SET "start" = positioned_mentions."start"
FROM positioned_mentions
WHERE positioned_mentions."commentId" = mention."commentId"
  AND positioned_mentions."userId" = mention."userId";

ALTER TABLE "CommentMention" ALTER COLUMN "start" SET NOT NULL;
ALTER TABLE "CommentMention" DROP CONSTRAINT "CommentMention_pkey";
ALTER TABLE "CommentMention"
  ADD CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("commentId", "start");
