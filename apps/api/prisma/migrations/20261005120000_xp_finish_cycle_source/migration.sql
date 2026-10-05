-- First finishes have been credited with the playthrough's / reading's id
-- since the tracking cycles, but under the entry's source type, so revoking
-- the cycle never reached them. Re-anchor them where they are revoked from.
--
-- A first finish already anchored on its cycle (from the tracking-cycles
-- migration) and still live wins over a duplicate under the old type: the
-- duplicate is revoked rather than moved, which would break the live-row
-- unique index.
UPDATE "XpEntry" old
SET "revokedAt" = NOW()
WHERE old."reason" IN ('GAME_FINISHED', 'BOOK_FINISHED')
  AND old."sourceType" IN ('GameEntry', 'BookEntry')
  AND old."revokedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "XpEntry" kept
    WHERE kept."userId" = old."userId"
      AND kept."reason" = old."reason"
      AND kept."sourceType" = CASE old."reason"
        WHEN 'GAME_FINISHED' THEN 'GamePlaythrough'
        ELSE 'BookReading'
      END
      AND kept."sourceId" = old."sourceId"
      AND kept."revokedAt" IS NULL
  );

UPDATE "XpEntry"
SET "sourceType" = 'GamePlaythrough'
WHERE "reason" = 'GAME_FINISHED' AND "sourceType" = 'GameEntry';

UPDATE "XpEntry"
SET "sourceType" = 'BookReading'
WHERE "reason" = 'BOOK_FINISHED' AND "sourceType" = 'BookEntry';

-- Revoking a duplicate above lowers its owner's total.
UPDATE "UserScore" score
SET "xp" = COALESCE((
  SELECT SUM(entry."amount") FROM "XpEntry" entry
  WHERE entry."userId" = score."userId" AND entry."revokedAt" IS NULL
), 0);
