-- AlterTable
ALTER TABLE "InstanceSettings" ADD COLUMN     "booksDomainEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gamesDomainEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mediaDomainEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "musicDomainEnabled" BOOLEAN NOT NULL DEFAULT true;
