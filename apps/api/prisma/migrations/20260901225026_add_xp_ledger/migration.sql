-- CreateTable
CREATE TABLE "XpEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScore" (
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserScore_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "XpEntry_userId_createdAt_idx" ON "XpEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpEntry_userId_reason_sourceType_sourceId_key" ON "XpEntry"("userId", "reason", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "UserScore_xp_idx" ON "UserScore"("xp");

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScore" ADD CONSTRAINT "UserScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
