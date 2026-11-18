-- CreateEnum
CREATE TYPE "AcquisitionSource" AS ENUM ('FRIEND', 'REDDIT', 'SEARCH_ENGINE', 'YOUTUBE', 'TIKTOK_INSTAGRAM', 'X_BLUESKY_MASTODON', 'DISCORD', 'ALTERNATIVETO_PRODUCTHUNT', 'SELFHOSTED_COMMUNITY', 'ARTICLE_BLOG', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acquisitionSource" "AcquisitionSource",
ADD COLUMN     "acquisitionSourceOther" TEXT;

-- AlterTable
ALTER TABLE "InstanceSettings" ADD COLUMN     "askAcquisitionSource" BOOLEAN NOT NULL DEFAULT false;
