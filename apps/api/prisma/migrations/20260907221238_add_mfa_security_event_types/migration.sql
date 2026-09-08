-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_TOTP_ENABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_TOTP_DISABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_EMAIL_ENABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_EMAIL_DISABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_WEBAUTHN_ADDED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_WEBAUTHN_REMOVED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_PASSWORDLESS_ENABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_PASSWORDLESS_DISABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_RECOVERY_CODES_REGENERATED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_RECOVERY_CODE_USED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MFA_CHALLENGE_LOCKED';
