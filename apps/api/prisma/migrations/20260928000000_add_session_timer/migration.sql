CREATE TABLE "SessionTimer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "gameEntryId" TEXT,
    "bookEntryId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "resumeTracking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTimer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SessionTimer_target_check" CHECK (
      ("domain" = 'GAMES' AND "gameEntryId" IS NOT NULL AND "bookEntryId" IS NULL)
      OR
      ("domain" = 'BOOKS' AND "bookEntryId" IS NOT NULL AND "gameEntryId" IS NULL)
    )
);

CREATE UNIQUE INDEX "SessionTimer_userId_key" ON "SessionTimer"("userId");
CREATE INDEX "SessionTimer_gameEntryId_idx" ON "SessionTimer"("gameEntryId");
CREATE INDEX "SessionTimer_bookEntryId_idx" ON "SessionTimer"("bookEntryId");

ALTER TABLE "SessionTimer" ADD CONSTRAINT "SessionTimer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionTimer" ADD CONSTRAINT "SessionTimer_gameEntryId_fkey"
  FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionTimer" ADD CONSTRAINT "SessionTimer_bookEntryId_fkey"
  FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
