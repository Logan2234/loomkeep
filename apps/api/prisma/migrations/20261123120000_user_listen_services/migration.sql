-- AlterTable
ALTER TABLE "User" ADD COLUMN     "listenServices" TEXT[] DEFAULT ARRAY[]::TEXT[];
