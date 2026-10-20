CREATE TYPE "ReleaseDatePrecision" AS ENUM ('DAY', 'MONTH', 'QUARTER', 'YEAR', 'TBD');

ALTER TABLE "GameItem" ADD COLUMN "releaseDatePrecision" "ReleaseDatePrecision";

ALTER TABLE "GameEntry" ADD COLUMN "releaseReminderAt" TIMESTAMP(3);
