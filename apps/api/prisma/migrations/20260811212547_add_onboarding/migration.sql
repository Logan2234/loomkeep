-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ALTER COLUMN "enabledDomains" SET DEFAULT ARRAY[]::"Domain"[];
