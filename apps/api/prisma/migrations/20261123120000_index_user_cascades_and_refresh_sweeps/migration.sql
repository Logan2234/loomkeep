-- DropIndex
DROP INDEX "UserDevice_userId_idx";

-- DropIndex
DROP INDEX "ApiCallCounter_provider_idx";

-- CreateIndex
CREATE INDEX "ReviewVote_userId_idx" ON "ReviewVote"("userId");

-- CreateIndex
CREATE INDEX "CommentReaction_userId_idx" ON "CommentReaction"("userId");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");

-- CreateIndex
CREATE INDEX "MessagePollVote_userId_idx" ON "MessagePollVote"("userId");

-- CreateIndex
CREATE INDEX "GameItem_lastSyncedAt_idx" ON "GameItem"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "BookItem_lastSyncedAt_idx" ON "BookItem"("lastSyncedAt");

