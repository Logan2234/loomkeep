-- AlterTable
ALTER TABLE "SecurityEvent" ALTER COLUMN "identifier" DROP NOT NULL;

-- Anonymise historical events whose account is already gone. LOGIN_FAILED is
-- excluded: its identifier is the string actually typed at a login attempt,
-- not tied to an account, and stays as-is regardless of account lifecycle
-- (see SecurityEventService#record).
UPDATE "SecurityEvent" SET "identifier" = NULL
WHERE "userId" IS NULL AND "type" != 'LOGIN_FAILED';

-- AlterTable
ALTER TABLE "ImportRun" DROP COLUMN "identifier";
