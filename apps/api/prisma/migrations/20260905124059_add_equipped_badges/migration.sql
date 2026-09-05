-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equippedBadgeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
