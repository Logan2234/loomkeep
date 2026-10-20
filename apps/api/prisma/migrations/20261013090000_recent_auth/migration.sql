-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'REAUTH_LOCKED';

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "reauthFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reauthenticatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaTotpLastStep" INTEGER;
