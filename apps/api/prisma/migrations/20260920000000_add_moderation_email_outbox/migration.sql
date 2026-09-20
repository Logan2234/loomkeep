CREATE TABLE "ModerationEmailOutbox" (
    "decisionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEmailOutbox_pkey" PRIMARY KEY ("decisionId")
);

CREATE INDEX "ModerationEmailOutbox_sentAt_nextAttemptAt_idx" ON "ModerationEmailOutbox"("sentAt", "nextAttemptAt");

ALTER TABLE "ModerationEmailOutbox" ADD CONSTRAINT "ModerationEmailOutbox_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ModerationDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
