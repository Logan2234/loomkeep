-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN     "acceptedTermsVersion" TEXT;

-- Backfill existing accounts: they were created and used under the CGU
-- version in effect on their own createdAt, which is the version in effect
-- at the time this migration ships ("2026-08-16", LEGAL_VERSION in
-- packages/shared/src/legal.ts). This isn't proof of an explicit acceptance
-- click, but it's the operative version those accounts were using the
-- service under.
UPDATE "User" SET "acceptedTermsAt" = "createdAt", "acceptedTermsVersion" = '2026-08-16';
