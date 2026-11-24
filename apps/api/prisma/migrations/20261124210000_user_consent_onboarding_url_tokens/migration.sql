-- Columns read once in an account's life move off the User row into three
-- one-to-one tables. A row is copied only for an account that has something
-- to keep: no row reads as "nothing set" in the app.
CREATE TABLE "UserConsent" (
    "userId" TEXT NOT NULL,
    "acceptedTermsAt" TIMESTAMP(3),
    "acceptedTermsVersion" TEXT,
    "certifiedAgeAt" TIMESTAMP(3),
    "newsletterOptInAt" TIMESTAMP(3),

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "UserOnboarding" (
    "userId" TEXT NOT NULL,
    "onboardedAt" TIMESTAMP(3),
    "acquisitionSource" "AcquisitionSource",
    "acquisitionSourceOther" TEXT,
    "skippedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gamifiedCompletedAt" TIMESTAMP(3),

    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "UserUrlToken" (
    "userId" TEXT NOT NULL,
    "calendarToken" TEXT,
    "activityFeedToken" TEXT,
    "newsletterUnsubscribeToken" TEXT,

    CONSTRAINT "UserUrlToken_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "UserConsent" ("userId", "acceptedTermsAt", "acceptedTermsVersion", "certifiedAgeAt", "newsletterOptInAt")
SELECT "id", "acceptedTermsAt", "acceptedTermsVersion", "certifiedAgeAt", "newsletterOptInAt"
FROM "User"
WHERE num_nonnulls("acceptedTermsAt", "acceptedTermsVersion", "certifiedAgeAt", "newsletterOptInAt") > 0;

INSERT INTO "UserOnboarding" ("userId", "onboardedAt", "acquisitionSource", "acquisitionSourceOther", "skippedSteps", "gamifiedCompletedAt")
SELECT "id", "onboardedAt", "acquisitionSource", "acquisitionSourceOther", COALESCE("onboardingSkippedSteps", ARRAY[]::TEXT[]), "onboardingGamifiedCompletedAt"
FROM "User"
WHERE num_nonnulls("onboardedAt", "acquisitionSource", "acquisitionSourceOther", "onboardingGamifiedCompletedAt") > 0
   OR cardinality("onboardingSkippedSteps") > 0;

INSERT INTO "UserUrlToken" ("userId", "calendarToken", "activityFeedToken", "newsletterUnsubscribeToken")
SELECT "id", "calendarToken", "activityFeedToken", "newsletterUnsubscribeToken"
FROM "User"
WHERE num_nonnulls("calendarToken", "activityFeedToken", "newsletterUnsubscribeToken") > 0;

CREATE INDEX "UserOnboarding_acquisitionSource_idx" ON "UserOnboarding"("acquisitionSource");
CREATE UNIQUE INDEX "UserUrlToken_calendarToken_key" ON "UserUrlToken"("calendarToken");
CREATE UNIQUE INDEX "UserUrlToken_activityFeedToken_key" ON "UserUrlToken"("activityFeedToken");
CREATE UNIQUE INDEX "UserUrlToken_newsletterUnsubscribeToken_key" ON "UserUrlToken"("newsletterUnsubscribeToken");

ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserUrlToken" ADD CONSTRAINT "UserUrlToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "User_activityFeedToken_key";
DROP INDEX "User_calendarToken_key";
DROP INDEX "User_newsletterUnsubscribeToken_key";

ALTER TABLE "User" DROP COLUMN "acceptedTermsAt",
DROP COLUMN "acceptedTermsVersion",
DROP COLUMN "acquisitionSource",
DROP COLUMN "acquisitionSourceOther",
DROP COLUMN "activityFeedToken",
DROP COLUMN "calendarToken",
DROP COLUMN "certifiedAgeAt",
DROP COLUMN "newsletterOptInAt",
DROP COLUMN "newsletterUnsubscribeToken",
DROP COLUMN "onboardedAt",
DROP COLUMN "onboardingGamifiedCompletedAt",
DROP COLUMN "onboardingSkippedSteps";
