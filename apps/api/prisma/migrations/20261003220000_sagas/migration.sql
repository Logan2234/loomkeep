-- CreateTable
CREATE TABLE "Saga" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Saga_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SagaMember" (
    "id" TEXT NOT NULL,
    "sagaKey" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "releaseDate" TEXT,
    "format" TEXT,
    "episodes" INTEGER,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "upcoming" BOOLEAN NOT NULL DEFAULT false,
    "announcedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SagaMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SagaMember_announcedAt_notifiedAt_idx" ON "SagaMember"("announcedAt", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SagaMember_sagaKey_sourceId_key" ON "SagaMember"("sagaKey", "sourceId");

-- AddForeignKey
ALTER TABLE "SagaMember" ADD CONSTRAINT "SagaMember_sagaKey_fkey" FOREIGN KEY ("sagaKey") REFERENCES "Saga"("key") ON DELETE CASCADE ON UPDATE CASCADE;
