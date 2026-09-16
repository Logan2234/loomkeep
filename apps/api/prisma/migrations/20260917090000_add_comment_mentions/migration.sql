-- Explicit mentions are selected from a discussion participant picker. This
-- avoids turning raw @text into a profile link or notification.
CREATE TABLE "CommentMention" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("commentId", "userId")
);

CREATE INDEX "CommentMention_userId_idx" ON "CommentMention"("userId");

ALTER TABLE "CommentMention"
  ADD CONSTRAINT "CommentMention_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentMention"
  ADD CONSTRAINT "CommentMention_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
