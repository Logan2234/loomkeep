-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('WEB', 'ANDROID');

-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN     "platform" "PushPlatform" NOT NULL DEFAULT 'WEB',
ALTER COLUMN "p256dh" DROP NOT NULL,
ALTER COLUMN "auth" DROP NOT NULL;
