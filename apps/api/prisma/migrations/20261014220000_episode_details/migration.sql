-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "airDate" TIMESTAMP(3),
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "voteAverage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "episodeType" TEXT,
ADD COLUMN     "streamingSite" TEXT,
ADD COLUMN     "streamingUrl" TEXT,
ADD COLUMN     "voteAverage" DOUBLE PRECISION,
ADD COLUMN     "voteCount" INTEGER;

-- CreateTable
CREATE TABLE "SeasonTranslation" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "overview" TEXT,

    CONSTRAINT "SeasonTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeTranslation" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "overview" TEXT,

    CONSTRAINT "EpisodeTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonTranslation_seasonId_locale_key" ON "SeasonTranslation"("seasonId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeTranslation_episodeId_locale_key" ON "EpisodeTranslation"("episodeId", "locale");

-- AddForeignKey
ALTER TABLE "SeasonTranslation" ADD CONSTRAINT "SeasonTranslation_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeTranslation" ADD CONSTRAINT "EpisodeTranslation_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
