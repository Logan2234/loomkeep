-- CreateTable
CREATE TABLE "BookSeries" (
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "series" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSeries_pkey" PRIMARY KEY ("key","locale")
);
