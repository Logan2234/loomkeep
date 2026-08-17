-- CreateTable
CREATE TABLE "MovieReplay" (
    "id" TEXT NOT NULL,
    "libraryEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieReplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovieReplay_libraryEntryId_idx" ON "MovieReplay"("libraryEntryId");

-- AddForeignKey
ALTER TABLE "MovieReplay" ADD CONSTRAINT "MovieReplay_libraryEntryId_fkey" FOREIGN KEY ("libraryEntryId") REFERENCES "LibraryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
