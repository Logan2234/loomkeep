-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "pickCount" INTEGER,
ADD COLUMN     "pickDomain" "Domain",
ADD COLUMN     "pickShared" BOOLEAN,
ADD COLUMN     "sagaDomain" "Domain",
ADD COLUMN     "sagaKey" TEXT,
ADD COLUMN     "whereWork" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chatShareWatchProviders" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MessagePoll" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "href" TEXT,
    "imageUrl" TEXT,

    CONSTRAINT "MessagePollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagePoll_messageId_key" ON "MessagePoll"("messageId");

-- CreateIndex
CREATE INDEX "MessagePollOption_pollId_idx" ON "MessagePollOption"("pollId");

-- CreateIndex
CREATE INDEX "MessagePollVote_optionId_idx" ON "MessagePollVote"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagePollVote_pollId_userId_key" ON "MessagePollVote"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "MessagePoll" ADD CONSTRAINT "MessagePoll_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePollOption" ADD CONSTRAINT "MessagePollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "MessagePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePollVote" ADD CONSTRAINT "MessagePollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "MessagePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePollVote" ADD CONSTRAINT "MessagePollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MessagePollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePollVote" ADD CONSTRAINT "MessagePollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
