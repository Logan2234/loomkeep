-- AlterTable
ALTER TABLE "User" ADD COLUMN     "watchProviderIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "watchRegion" TEXT;
