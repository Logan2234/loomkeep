-- Profile pictures move out of the User row into their own table, so a User
-- read without a `select` no longer drags the image along.
CREATE TABLE "UserAvatar" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserAvatar" ("userId", "data", "mimeType")
SELECT "id", "avatar", COALESCE("avatarMimeType", 'image/webp')
FROM "User"
WHERE "avatar" IS NOT NULL;

-- avatarUpdatedAt now alone says whether there is a picture.
UPDATE "User" SET "avatarUpdatedAt" = NULL
WHERE "avatar" IS NULL AND "avatarUpdatedAt" IS NOT NULL;
UPDATE "User" SET "avatarUpdatedAt" = CURRENT_TIMESTAMP
WHERE "avatar" IS NOT NULL AND "avatarUpdatedAt" IS NULL;

ALTER TABLE "User" DROP COLUMN "avatar",
DROP COLUMN "avatarMimeType";

-- A dump outgrows Int's 2 GiB.
ALTER TABLE "BackupFile" ALTER COLUMN "sizeBytes" SET DATA TYPE BIGINT;

-- Messages react with the same set as comments.
ALTER TYPE "CommentEmote" RENAME TO "Emote";

-- Ratings: 0 to 10 in half points (RATING_STEP). Exact in a float, so the
-- column type stays; anything off the grid is snapped first.
UPDATE "Review" SET "rating" = round(LEAST(GREATEST("rating", 0), 10)::numeric * 2) / 2
WHERE "rating" <> round(LEAST(GREATEST("rating", 0), 10)::numeric * 2) / 2;
UPDATE "ReviewRevision" SET "rating" = round(LEAST(GREATEST("rating", 0), 10)::numeric * 2) / 2
WHERE "rating" <> round(LEAST(GREATEST("rating", 0), 10)::numeric * 2) / 2;

ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check"
  CHECK ("rating" BETWEEN 0 AND 10 AND "rating" * 2 = floor("rating" * 2));
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_rating_check"
  CHECK ("rating" BETWEEN 0 AND 10 AND "rating" * 2 = floor("rating" * 2));

-- Positions, pages, durations and counters never go below zero.
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_position_check" CHECK ("position" >= 0);
ALTER TABLE "MessageEmbed" ADD CONSTRAINT "MessageEmbed_position_check" CHECK ("position" >= 0);
ALTER TABLE "MessagePollOption" ADD CONSTRAINT "MessagePollOption_position_check" CHECK ("position" >= 0);
ALTER TABLE "SagaMember" ADD CONSTRAINT "SagaMember_position_check" CHECK ("position" >= 0);
ALTER TABLE "GameSagaMember" ADD CONSTRAINT "GameSagaMember_position_check" CHECK ("position" >= 0);
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_pages_check"
  CHECK ("currentPage" >= 0 AND "readingBaselinePage" >= 0);
ALTER TABLE "BookReading" ADD CONSTRAINT "BookReading_pages_check"
  CHECK ("currentPage" >= 0 AND "baselinePage" >= 0);
ALTER TABLE "BookSession" ADD CONSTRAINT "BookSession_amounts_check"
  CHECK ("pagesRead" >= 0 AND "durationMinutes" >= 0);
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_durationMinutes_check"
  CHECK ("durationMinutes" >= 0);
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_playtimeMinutes_check"
  CHECK ("playtimeMinutes" >= 0);
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_uses_check"
  CHECK ("useCount" >= 0 AND "useCount" <= "maxUses");

-- Ownership and loans, as entry-loan.util.ts writes them: a source only on a
-- status that carries one, a loan only on a BORROWED entry or a PHYSICAL one
-- lent out.
ALTER TABLE "LibraryEntry"
  ADD CONSTRAINT "LibraryEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  ),
  ADD CONSTRAINT "LibraryEntry_loan_check" CHECK (
    (NOT "lentOut" OR "ownershipStatus" = 'PHYSICAL')
    AND (
      ("loanPerson" IS NULL AND "loanSince" IS NULL)
      OR "lentOut"
      OR "ownershipStatus" = 'BORROWED'
    )
  );
ALTER TABLE "GameEntry"
  ADD CONSTRAINT "GameEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  ),
  ADD CONSTRAINT "GameEntry_loan_check" CHECK (
    (NOT "lentOut" OR "ownershipStatus" = 'PHYSICAL')
    AND (
      ("loanPerson" IS NULL AND "loanSince" IS NULL)
      OR "lentOut"
      OR "ownershipStatus" = 'BORROWED'
    )
  );
ALTER TABLE "BookEntry"
  ADD CONSTRAINT "BookEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  ),
  ADD CONSTRAINT "BookEntry_loan_check" CHECK (
    (NOT "lentOut" OR "ownershipStatus" = 'PHYSICAL')
    AND (
      ("loanPerson" IS NULL AND "loanSince" IS NULL)
      OR "lentOut"
      OR "ownershipStatus" = 'BORROWED'
    )
  );
ALTER TABLE "MusicEntry"
  ADD CONSTRAINT "MusicEntry_ownershipSource_check" CHECK (
    "ownershipSource" IS NULL OR "ownershipStatus" NOT IN ('NONE', 'BORROWED')
  ),
  ADD CONSTRAINT "MusicEntry_loan_check" CHECK (
    (NOT "lentOut" OR "ownershipStatus" = 'PHYSICAL')
    AND (
      ("loanPerson" IS NULL AND "loanSince" IS NULL)
      OR "lentOut"
      OR "ownershipStatus" = 'BORROWED'
    )
  );

-- The free-text "how did you hear of us" only goes with OTHER.
ALTER TABLE "User" ADD CONSTRAINT "User_acquisitionSourceOther_check"
  CHECK (
    "acquisitionSourceOther" IS NULL
    OR "acquisitionSource" IS NOT DISTINCT FROM 'OTHER'
  );

-- (A NULL would make a CHECK pass: hence IS NOT DISTINCT FROM / IS NOT NULL.)

-- A report's motif belongs to its category (REPORT_CATEGORY_MOTIFS in
-- packages/shared/src/report-categories.ts — keep both in lockstep). OTHER
-- has none.
ALTER TABLE "Report" ADD CONSTRAINT "Report_motif_check" CHECK (
  "motif" IS NULL OR "category" IS NOT NULL AND ("category"::text, "motif"::text) IN (
    ('SPAM', 'SPAM_PROMOTIONAL'),
    ('SPAM', 'SPAM_SUSPICIOUS_LINK'),
    ('SPAM', 'SPAM_REPEATED'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_PIRACY_LINK'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_TERRORISM'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_DEFAMATION'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_OTHER'),
    ('HARASSMENT', 'HARASSMENT_INSULTS'),
    ('HARASSMENT', 'HARASSMENT_THREATS'),
    ('HARASSMENT', 'HARASSMENT_STALKING'),
    ('HARASSMENT', 'HARASSMENT_DOXXING'),
    ('HATE_SPEECH', 'HATE_RACISM'),
    ('HATE_SPEECH', 'HATE_SEXISM_LGBTQ'),
    ('HATE_SPEECH', 'HATE_OTHER'),
    ('SEXUAL_CONTENT', 'SEXUAL_EXPLICIT'),
    ('VIOLENCE', 'VIOLENCE_GRAPHIC'),
    ('MINOR_ENDANGERMENT', 'MINOR_ENDANGERMENT_CONTENT'),
    ('MINOR_ENDANGERMENT', 'MINOR_ENDANGERMENT_SOLICITATION'),
    ('SPOILER', 'SPOILER_UNTAGGED'),
    ('IMPERSONATION', 'IMPERSONATION_REAL_PERSON'),
    ('MISINFORMATION', 'MISINFORMATION_FALSE_FACT'),
    ('STOLEN_CONTENT', 'STOLEN_CONTENT_PLAGIARIZED'),
    ('STOLEN_CONTENT', 'STOLEN_CONTENT_IMAGE'),
    ('MISLEADING_REVIEW', 'MISLEADING_REVIEW_MANIPULATION'),
    ('MISLEADING_REVIEW', 'MISLEADING_REVIEW_OFF_TOPIC'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_BOT'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_UNDERAGE'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_BAN_EVASION'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_MANIPULATION')
  )
);
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_reasonMotif_check" CHECK (
  "reasonMotif" IS NULL OR "reasonCategory" IS NOT NULL AND ("reasonCategory"::text, "reasonMotif"::text) IN (
    ('SPAM', 'SPAM_PROMOTIONAL'),
    ('SPAM', 'SPAM_SUSPICIOUS_LINK'),
    ('SPAM', 'SPAM_REPEATED'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_PIRACY_LINK'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_TERRORISM'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_DEFAMATION'),
    ('ILLEGAL_CONTENT', 'ILLEGAL_OTHER'),
    ('HARASSMENT', 'HARASSMENT_INSULTS'),
    ('HARASSMENT', 'HARASSMENT_THREATS'),
    ('HARASSMENT', 'HARASSMENT_STALKING'),
    ('HARASSMENT', 'HARASSMENT_DOXXING'),
    ('HATE_SPEECH', 'HATE_RACISM'),
    ('HATE_SPEECH', 'HATE_SEXISM_LGBTQ'),
    ('HATE_SPEECH', 'HATE_OTHER'),
    ('SEXUAL_CONTENT', 'SEXUAL_EXPLICIT'),
    ('VIOLENCE', 'VIOLENCE_GRAPHIC'),
    ('MINOR_ENDANGERMENT', 'MINOR_ENDANGERMENT_CONTENT'),
    ('MINOR_ENDANGERMENT', 'MINOR_ENDANGERMENT_SOLICITATION'),
    ('SPOILER', 'SPOILER_UNTAGGED'),
    ('IMPERSONATION', 'IMPERSONATION_REAL_PERSON'),
    ('MISINFORMATION', 'MISINFORMATION_FALSE_FACT'),
    ('STOLEN_CONTENT', 'STOLEN_CONTENT_PLAGIARIZED'),
    ('STOLEN_CONTENT', 'STOLEN_CONTENT_IMAGE'),
    ('MISLEADING_REVIEW', 'MISLEADING_REVIEW_MANIPULATION'),
    ('MISLEADING_REVIEW', 'MISLEADING_REVIEW_OFF_TOPIC'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_BOT'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_UNDERAGE'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_BAN_EVASION'),
    ('NONCOMPLIANT_ACCOUNT', 'ACCOUNT_MANIPULATION')
  )
);
