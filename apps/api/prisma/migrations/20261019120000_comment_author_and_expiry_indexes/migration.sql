-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "UserToken_expiresAt_idx" ON "UserToken"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_expiresAt_idx" ON "EmailChangeRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "MfaLoginChallenge_expiresAt_idx" ON "MfaLoginChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "WebauthnChallenge_expiresAt_idx" ON "WebauthnChallenge"("expiresAt");
