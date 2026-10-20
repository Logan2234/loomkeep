-- AlterTable
ALTER TABLE "CommentThreadRead" ADD COLUMN     "mutedAt" TIMESTAMP(3),
ALTER COLUMN "lastReadAt" DROP NOT NULL;
