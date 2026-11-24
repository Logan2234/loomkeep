-- One ownership enum for the four domains, each entry table keeping its own
-- subset through a CHECK; loans move from three columns per entry table to a
-- Loan table that keeps returned loans as history.

CREATE TYPE "OwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'SUBSCRIPTION', 'AUDIO', 'BORROWED');
CREATE TYPE "LoanDirection" AS ENUM ('LENT', 'BORROWED');

CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "libraryEntryId" TEXT,
    "gameEntryId" TEXT,
    "bookEntryId" TEXT,
    "musicEntryId" TEXT,
    "direction" "LoanDirection" NOT NULL,
    "person" TEXT,
    "since" DATE,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id"),
    -- Exactly one entry, of whichever domain.
    CONSTRAINT "Loan_entry_check" CHECK (
      num_nonnulls("libraryEntryId", "gameEntryId", "bookEntryId", "musicEntryId") = 1
    )
);

CREATE INDEX "Loan_libraryEntryId_idx" ON "Loan"("libraryEntryId");
CREATE INDEX "Loan_gameEntryId_idx" ON "Loan"("gameEntryId");
CREATE INDEX "Loan_bookEntryId_idx" ON "Loan"("bookEntryId");
CREATE INDEX "Loan_musicEntryId_idx" ON "Loan"("musicEntryId");

-- At most one open loan per entry and direction (Prisma has no partial unique).
CREATE UNIQUE INDEX "Loan_libraryEntryId_open_key" ON "Loan"("libraryEntryId", "direction") WHERE "returnedAt" IS NULL AND "libraryEntryId" IS NOT NULL;
CREATE UNIQUE INDEX "Loan_gameEntryId_open_key" ON "Loan"("gameEntryId", "direction") WHERE "returnedAt" IS NULL AND "gameEntryId" IS NOT NULL;
CREATE UNIQUE INDEX "Loan_bookEntryId_open_key" ON "Loan"("bookEntryId", "direction") WHERE "returnedAt" IS NULL AND "bookEntryId" IS NOT NULL;
CREATE UNIQUE INDEX "Loan_musicEntryId_open_key" ON "Loan"("musicEntryId", "direction") WHERE "returnedAt" IS NULL AND "musicEntryId" IS NOT NULL;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_libraryEntryId_fkey" FOREIGN KEY ("libraryEntryId") REFERENCES "LibraryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_gameEntryId_fkey" FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookEntryId_fkey" FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_musicEntryId_fkey" FOREIGN KEY ("musicEntryId") REFERENCES "MusicEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The loans the columns held: a lent PHYSICAL copy, a BORROWED entry.
INSERT INTO "Loan" ("id", "libraryEntryId", "direction", "person", "since")
SELECT gen_random_uuid()::text, "id",
       CASE WHEN "ownershipStatus" = 'BORROWED' THEN 'BORROWED' ELSE 'LENT' END::"LoanDirection",
       "loanPerson", "loanSince"
FROM "LibraryEntry"
WHERE "ownershipStatus" = 'BORROWED' OR ("ownershipStatus" = 'PHYSICAL' AND "lentOut");
INSERT INTO "Loan" ("id", "gameEntryId", "direction", "person", "since")
SELECT gen_random_uuid()::text, "id",
       CASE WHEN "ownershipStatus" = 'BORROWED' THEN 'BORROWED' ELSE 'LENT' END::"LoanDirection",
       "loanPerson", "loanSince"
FROM "GameEntry"
WHERE "ownershipStatus" = 'BORROWED' OR ("ownershipStatus" = 'PHYSICAL' AND "lentOut");
INSERT INTO "Loan" ("id", "bookEntryId", "direction", "person", "since")
SELECT gen_random_uuid()::text, "id",
       CASE WHEN "ownershipStatus" = 'BORROWED' THEN 'BORROWED' ELSE 'LENT' END::"LoanDirection",
       "loanPerson", "loanSince"
FROM "BookEntry"
WHERE "ownershipStatus" = 'BORROWED' OR ("ownershipStatus" = 'PHYSICAL' AND "lentOut");
INSERT INTO "Loan" ("id", "musicEntryId", "direction", "person", "since")
SELECT gen_random_uuid()::text, "id",
       CASE WHEN "ownershipStatus" = 'BORROWED' THEN 'BORROWED' ELSE 'LENT' END::"LoanDirection",
       "loanPerson", "loanSince"
FROM "MusicEntry"
WHERE "ownershipStatus" = 'BORROWED' OR ("ownershipStatus" = 'PHYSICAL' AND "lentOut");

-- The constraints on the old columns go before them; the source one comes
-- back below, on the new type.
ALTER TABLE "LibraryEntry"
  DROP CONSTRAINT "LibraryEntry_loan_check",
  DROP CONSTRAINT "LibraryEntry_ownershipSource_check",
  DROP COLUMN "lentOut",
  DROP COLUMN "loanPerson",
  DROP COLUMN "loanSince",
  ALTER COLUMN "ownershipStatus" DROP DEFAULT,
  ALTER COLUMN "ownershipStatus" SET DATA TYPE "OwnershipStatus" USING "ownershipStatus"::text::"OwnershipStatus",
  ALTER COLUMN "ownershipStatus" SET DEFAULT 'NONE';
ALTER TABLE "GameEntry"
  DROP CONSTRAINT "GameEntry_loan_check",
  DROP CONSTRAINT "GameEntry_ownershipSource_check",
  DROP COLUMN "lentOut",
  DROP COLUMN "loanPerson",
  DROP COLUMN "loanSince",
  ALTER COLUMN "ownershipStatus" DROP DEFAULT,
  ALTER COLUMN "ownershipStatus" SET DATA TYPE "OwnershipStatus" USING "ownershipStatus"::text::"OwnershipStatus",
  ALTER COLUMN "ownershipStatus" SET DEFAULT 'NONE';
ALTER TABLE "BookEntry"
  DROP CONSTRAINT "BookEntry_loan_check",
  DROP CONSTRAINT "BookEntry_ownershipSource_check",
  DROP COLUMN "lentOut",
  DROP COLUMN "loanPerson",
  DROP COLUMN "loanSince",
  ALTER COLUMN "ownershipStatus" DROP DEFAULT,
  ALTER COLUMN "ownershipStatus" SET DATA TYPE "OwnershipStatus" USING "ownershipStatus"::text::"OwnershipStatus",
  ALTER COLUMN "ownershipStatus" SET DEFAULT 'NONE';
ALTER TABLE "MusicEntry"
  DROP CONSTRAINT "MusicEntry_loan_check",
  DROP CONSTRAINT "MusicEntry_ownershipSource_check",
  DROP COLUMN "lentOut",
  DROP COLUMN "loanPerson",
  DROP COLUMN "loanSince",
  ALTER COLUMN "ownershipStatus" DROP DEFAULT,
  ALTER COLUMN "ownershipStatus" SET DATA TYPE "OwnershipStatus" USING "ownershipStatus"::text::"OwnershipStatus",
  ALTER COLUMN "ownershipStatus" SET DEFAULT 'NONE';

-- Each domain's own statuses (the lists in packages/shared/src/enums.ts),
-- and a source only on a status that carries one.
ALTER TABLE "LibraryEntry"
  ADD CONSTRAINT "LibraryEntry_ownershipStatus_check" CHECK ("ownershipStatus" IN ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED')),
  ADD CONSTRAINT "LibraryEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  );
ALTER TABLE "GameEntry"
  ADD CONSTRAINT "GameEntry_ownershipStatus_check" CHECK ("ownershipStatus" IN ('NONE', 'PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'BORROWED')),
  ADD CONSTRAINT "GameEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  );
ALTER TABLE "BookEntry"
  ADD CONSTRAINT "BookEntry_ownershipStatus_check" CHECK ("ownershipStatus" IN ('NONE', 'PHYSICAL', 'DIGITAL', 'AUDIO', 'BORROWED')),
  ADD CONSTRAINT "BookEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  );
ALTER TABLE "MusicEntry"
  ADD CONSTRAINT "MusicEntry_ownershipStatus_check" CHECK ("ownershipStatus" IN ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED')),
  ADD CONSTRAINT "MusicEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  );

DROP TYPE "MediaOwnershipStatus";
DROP TYPE "GameOwnershipStatus";
DROP TYPE "BookOwnershipStatus";
DROP TYPE "MusicOwnershipStatus";
