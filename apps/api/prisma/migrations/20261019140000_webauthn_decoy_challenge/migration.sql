-- A passwordless decoy challenge is bound to no account (SEC-06).
ALTER TABLE "WebauthnChallenge" ALTER COLUMN "userId" DROP NOT NULL;
