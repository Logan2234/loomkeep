-- AlterTable
ALTER TABLE "User" ADD COLUMN "alertPrefs" JSONB NOT NULL DEFAULT '{}';

-- Accounts that existed before per-alert push get every activity push on;
-- new accounts start with them off (the ALERTS defaults).
UPDATE "User" SET "alertPrefs" = '{"COMMENT_REPLY":{"push":true},"COMMENT_MENTION":{"push":true},"FOLLOW_REQUEST":{"push":true},"FOLLOW":{"push":true},"FOLLOW_ACCEPTED":{"push":true},"LIST_MEMBER_ADDED":{"push":true},"LIST_ITEM_ADDED":{"push":true},"INVITATION_ACCEPTED":{"push":true},"IMPORT_FINISHED":{"push":true}}';
