ALTER TABLE "MediaItem" ADD COLUMN "movieReleaseDates" JSONB;
ALTER TABLE "LibraryEntry" ADD COLUMN "movieReleaseReminderAt" TIMESTAMP(3), ADD COLUMN "movieReleaseRegion" TEXT;
