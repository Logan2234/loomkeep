-- AlterTable
ALTER TABLE "GameItem" ADD COLUMN     "sagaKey" TEXT;

-- CreateIndex
CREATE INDEX "GameItem_sagaKey_idx" ON "GameItem"("sagaKey");

-- CreateTable
CREATE TABLE "GameSaga" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSaga_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GameSagaMember" (
    "id" TEXT NOT NULL,
    "sagaKey" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "releaseDate" TEXT,
    "releaseDatePrecision" "ReleaseDatePrecision",
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "upcoming" BOOLEAN NOT NULL DEFAULT false,
    "announcedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSagaMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSagaMember_announcedAt_notifiedAt_idx" ON "GameSagaMember"("announcedAt", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSagaMember_sagaKey_sourceId_key" ON "GameSagaMember"("sagaKey", "sourceId");

-- AddForeignKey
ALTER TABLE "GameSagaMember" ADD CONSTRAINT "GameSagaMember_sagaKey_fkey" FOREIGN KEY ("sagaKey") REFERENCES "GameSaga"("key") ON DELETE CASCADE ON UPDATE CASCADE;
