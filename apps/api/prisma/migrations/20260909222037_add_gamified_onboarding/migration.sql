ALTER TABLE "User" ADD COLUMN     "onboardingGamifiedCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingSkippedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];
