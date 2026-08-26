-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaTotpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaTotpSecretEnc" TEXT;

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totpAllowed" BOOLEAN NOT NULL DEFAULT false,
    "emailAllowed" BOOLEAN NOT NULL DEFAULT false,
    "emailCodeHash" TEXT,
    "emailCodeExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaLoginChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "MfaLoginChallenge_userId_idx" ON "MfaLoginChallenge"("userId");

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaLoginChallenge" ADD CONSTRAINT "MfaLoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

