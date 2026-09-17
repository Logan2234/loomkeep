-- CreateEnum
CREATE TYPE "SpoilerSensitivity" AS ENUM ('AUTO', 'ALWAYS_HIDDEN', 'ALWAYS_REVEALED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "spoilerSensitivity" "SpoilerSensitivity" NOT NULL DEFAULT 'AUTO';
