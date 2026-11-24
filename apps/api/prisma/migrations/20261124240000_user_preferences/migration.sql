-- The settings chosen in Réglages move off the User row into UserPreferences,
-- one row per account: every existing account gets its row, with its current
-- values. locale, timezone and enabledDomains stay on User: nearly every email,
-- notification and domain check reads them.
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "allowAdultContent" BOOLEAN NOT NULL DEFAULT false,
    "hideProgression" BOOLEAN NOT NULL DEFAULT false,
    "chatShowPresence" BOOLEAN NOT NULL DEFAULT true,
    "chatShowReadReceipts" BOOLEAN NOT NULL DEFAULT true,
    "chatShareWatchProviders" BOOLEAN NOT NULL DEFAULT false,
    "feedbackWidget" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" "DigestCadence" NOT NULL DEFAULT 'WEEKLY',
    "notifyPush" "DigestCadence" NOT NULL DEFAULT 'WEEKLY',
    "alertPrefs" JSONB NOT NULL DEFAULT '{}',
    "notifyNewsletter" BOOLEAN NOT NULL DEFAULT false,
    "defaultReviewVisibility" "ReviewVisibility" NOT NULL DEFAULT 'FRIENDS',
    "defaultListVisibility" "ListVisibility" NOT NULL DEFAULT 'PRIVATE',
    "spoilerSensitivity" "SpoilerSensitivity" NOT NULL DEFAULT 'AUTO',
    "domainOrder" "Domain"[] DEFAULT ARRAY[]::"Domain"[],
    "watchRegion" TEXT,
    "watchProviderIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "listenServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "homeLayout" JSONB,
    "homePhoneLayout" JSONB,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "UserPreferences" ("userId", "allowAdultContent", "hideProgression", "chatShowPresence", "chatShowReadReceipts", "chatShareWatchProviders", "feedbackWidget", "notifyEmail", "notifyPush", "alertPrefs", "notifyNewsletter", "defaultReviewVisibility", "defaultListVisibility", "spoilerSensitivity", "domainOrder", "watchRegion", "watchProviderIds", "listenServices", "homeLayout", "homePhoneLayout")
SELECT "id", "allowAdultContent", "hideProgression", "chatShowPresence", "chatShowReadReceipts", "chatShareWatchProviders", "feedbackWidget", "notifyEmail", "notifyPush", "alertPrefs", "notifyNewsletter", "defaultReviewVisibility", "defaultListVisibility", "spoilerSensitivity", "domainOrder", "watchRegion", "watchProviderIds", "listenServices", "homeLayout", "homePhoneLayout"
FROM "User";

ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN "alertPrefs",
DROP COLUMN "allowAdultContent",
DROP COLUMN "chatShareWatchProviders",
DROP COLUMN "chatShowPresence",
DROP COLUMN "chatShowReadReceipts",
DROP COLUMN "defaultListVisibility",
DROP COLUMN "defaultReviewVisibility",
DROP COLUMN "domainOrder",
DROP COLUMN "feedbackWidget",
DROP COLUMN "hideProgression",
DROP COLUMN "homeLayout",
DROP COLUMN "homePhoneLayout",
DROP COLUMN "listenServices",
DROP COLUMN "notifyEmail",
DROP COLUMN "notifyNewsletter",
DROP COLUMN "notifyPush",
DROP COLUMN "spoilerSensitivity",
DROP COLUMN "watchProviderIds",
DROP COLUMN "watchRegion";
