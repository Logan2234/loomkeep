-- CreateIndex
CREATE INDEX "Notification_dedupeKey_idx" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Episode_airDate_idx" ON "Episode"("airDate");

-- CreateIndex
CREATE INDEX "LibraryEntry_mediaItemId_idx" ON "LibraryEntry"("mediaItemId");

-- CreateIndex
CREATE INDEX "GameEntry_gameItemId_idx" ON "GameEntry"("gameItemId");

-- CreateIndex
CREATE INDEX "BookEntry_bookItemId_idx" ON "BookEntry"("bookItemId");

-- CreateIndex
CREATE INDEX "MusicEntry_musicItemId_idx" ON "MusicEntry"("musicItemId");

