-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "expiryNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InstanceSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "socialEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicApiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "apiRateLimitFree" INTEGER NOT NULL DEFAULT 60,
    "apiRateLimitPremium" INTEGER NOT NULL DEFAULT 300,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");
