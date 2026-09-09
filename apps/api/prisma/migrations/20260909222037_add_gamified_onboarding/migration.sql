/*
  Warnings:

  - Made the column `watchedAt` on table `EpisodeWatch` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EpisodeWatch" ALTER COLUMN "watchedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingGamifiedCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingSkippedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];
