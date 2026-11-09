-- Messages' list: pin a conversation or a work's discussion, remove a
-- conversation from the list, stop following a discussion.
ALTER TABLE "ConversationMember" ADD COLUMN "pinnedAt" TIMESTAMP(3),
ADD COLUMN "hiddenAt" TIMESTAMP(3);

ALTER TABLE "CommentThreadRead" ADD COLUMN "pinnedAt" TIMESTAMP(3),
ADD COLUMN "unfollowedAt" TIMESTAMP(3);
