-- Countries of origin of films and series (CAT-01), filled by the next sync.
ALTER TABLE "MediaItem" ADD COLUMN "originCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
