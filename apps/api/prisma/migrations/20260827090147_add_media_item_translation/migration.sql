-- CreateTable
CREATE TABLE "MediaItemTranslation" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "genres" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItemTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaItemTranslation_mediaItemId_locale_key" ON "MediaItemTranslation"("mediaItemId", "locale");

-- AddForeignKey
ALTER TABLE "MediaItemTranslation" ADD CONSTRAINT "MediaItemTranslation_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
