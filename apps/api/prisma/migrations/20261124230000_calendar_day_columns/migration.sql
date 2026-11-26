-- Release dates and birth dates are calendar days, stored until now as
-- midnight UTC. As DATE they carry no time and no time zone, so nothing can
-- shift them a day. Values are already midnight UTC: the cast keeps the day.
ALTER TABLE "User" ALTER COLUMN "birthDate" SET DATA TYPE DATE USING "birthDate"::date;
ALTER TABLE "MediaItem" ALTER COLUMN "releaseDate" SET DATA TYPE DATE USING "releaseDate"::date;
ALTER TABLE "GameItem" ALTER COLUMN "releaseDate" SET DATA TYPE DATE USING "releaseDate"::date;
ALTER TABLE "BookItem" ALTER COLUMN "releaseDate" SET DATA TYPE DATE USING "releaseDate"::date;
ALTER TABLE "MusicItem" ALTER COLUMN "releaseDate" SET DATA TYPE DATE USING "releaseDate"::date;
