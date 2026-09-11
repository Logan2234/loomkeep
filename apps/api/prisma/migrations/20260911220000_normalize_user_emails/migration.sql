-- Emails are now normalized (trimmed, lowercased) on the way in — see
-- apps/api/src/common/email.util.ts. This folds the rows written before that.
--
-- Rows whose lowercase form would collide with another account are left
-- untouched on purpose: those are two real, separately-registered accounts
-- (the very situation the normalisation prevents from recurring), and picking
-- a winner here would lock someone out of their own data. They keep working
-- exactly as before; merging them is a human decision.
UPDATE "User" u
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email))
  AND NOT EXISTS (
    SELECT 1
    FROM "User" other
    WHERE other.id <> u.id
      AND lower(btrim(other.email)) = lower(btrim(u.email))
  );

-- Same treatment for pending email changes, so a request created before this
-- migration doesn't write a mixed-case address back on confirmation.
UPDATE "EmailChangeRequest"
SET "newEmail" = lower(btrim("newEmail"))
WHERE "newEmail" <> lower(btrim("newEmail"));
