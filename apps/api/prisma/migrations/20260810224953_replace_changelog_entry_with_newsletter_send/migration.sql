-- DropTable
DROP TABLE "ChangelogEntry";

-- CreateTable
CREATE TABLE "NewsletterSend" (
    "id" TEXT NOT NULL,
    "quackbackChangelogId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSend_quackbackChangelogId_key" ON "NewsletterSend"("quackbackChangelogId");

-- CreateIndex
CREATE INDEX "NewsletterSend_sentAt_idx" ON "NewsletterSend"("sentAt");

