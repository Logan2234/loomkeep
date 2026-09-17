-- Author-set spoiler flag on reviews, mirroring Comment.spoilerTag.
ALTER TABLE "Review" ADD COLUMN "spoilerTag" BOOLEAN NOT NULL DEFAULT false;
