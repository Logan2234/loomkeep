-- Review moderation: an off-topic review motif, and a take-down measure for
-- reviews alongside the existing comment one.
ALTER TYPE "ReportMotif" ADD VALUE 'MISLEADING_REVIEW_OFF_TOPIC';
ALTER TYPE "ModerationMeasure" ADD VALUE 'REVIEW_REMOVED' AFTER 'COMMENT_REMOVED';
