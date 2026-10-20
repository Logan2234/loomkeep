-- CreateTable
CREATE TABLE "CommentThreadRead" (
    "userId" TEXT NOT NULL,
    "targetType" "CommentTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentThreadRead_pkey" PRIMARY KEY ("userId","targetType","targetId")
);

-- AddForeignKey
ALTER TABLE "CommentThreadRead" ADD CONSTRAINT "CommentThreadRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
