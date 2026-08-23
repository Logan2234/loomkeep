-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "inactivityWarningSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- Backfill existing accounts: lastActiveAt is the most recent proof of
-- activity we have for them, whichever of the two pre-existing (but
-- individually incomplete — see LK-C06) signals is freshest, falling back to
-- createdAt for an account that never logged in from a durable device or
-- currently has no live session.
UPDATE "User" u
SET "lastActiveAt" = GREATEST(
  u."createdAt",
  COALESCE((SELECT MAX(rt."lastUsedAt") FROM "RefreshToken" rt WHERE rt."userId" = u.id), u."createdAt"),
  COALESCE((SELECT MAX(ud."lastSeenAt") FROM "UserDevice" ud WHERE ud."userId" = u.id), u."createdAt")
);
