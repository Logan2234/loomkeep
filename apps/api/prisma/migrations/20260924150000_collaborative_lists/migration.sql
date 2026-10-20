-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "addedById" TEXT;

-- Items that predate attribution are credited to the list's owner.
UPDATE "ListItem" AS item
SET "addedById" = list."userId"
FROM "List" AS list
WHERE item."listId" = list."id";

-- CreateTable
CREATE TABLE "ListNotificationMute" (
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListNotificationMute_pkey" PRIMARY KEY ("listId","userId")
);

-- CreateIndex
CREATE INDEX "ListNotificationMute_userId_idx" ON "ListNotificationMute"("userId");

-- CreateIndex
CREATE INDEX "ListItem_addedById_idx" ON "ListItem"("addedById");

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListNotificationMute" ADD CONSTRAINT "ListNotificationMute_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListNotificationMute" ADD CONSTRAINT "ListNotificationMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
