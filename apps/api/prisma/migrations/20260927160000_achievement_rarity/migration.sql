-- CreateTable
CREATE TABLE "AchievementRarity" (
    "key" TEXT NOT NULL,
    "holders" INTEGER NOT NULL,
    "eligibleUsers" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementRarity_pkey" PRIMARY KEY ("key")
);
