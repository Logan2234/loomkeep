-- Join and lookup tables whose rows are already identified by a unique pair
-- (or triple): that becomes the primary key, and the unused cuid `id` goes.
-- Left out on purpose: tables whose id is read by the app or stored
-- elsewhere — Follow (follow requests), ListMember, UserDevice,
-- UserAchievement, and ReviewVote, CommentReaction and ReadingGoal, whose
-- ids are XpEntry sources.

ALTER TABLE "ApiCallCounter" DROP CONSTRAINT "ApiCallCounter_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "ApiCallCounter_pkey" PRIMARY KEY ("provider", "day");
DROP INDEX "ApiCallCounter_provider_day_key";

ALTER TABLE "Block" DROP CONSTRAINT "Block_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId", "blockedId");
DROP INDEX "Block_blockerId_blockedId_key";

ALTER TABLE "BookExternalId" DROP CONSTRAINT "BookExternalId_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "BookExternalId_pkey" PRIMARY KEY ("source", "externalId");
DROP INDEX "BookExternalId_source_externalId_key";

ALTER TABLE "EpisodeTranslation" DROP CONSTRAINT "EpisodeTranslation_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "EpisodeTranslation_pkey" PRIMARY KEY ("episodeId", "locale");
DROP INDEX "EpisodeTranslation_episodeId_locale_key";

ALTER TABLE "GameExternalId" DROP CONSTRAINT "GameExternalId_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "GameExternalId_pkey" PRIMARY KEY ("source", "externalId");
DROP INDEX "GameExternalId_source_externalId_key";

ALTER TABLE "MediaExternalId" DROP CONSTRAINT "MediaExternalId_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "MediaExternalId_pkey" PRIMARY KEY ("source", "externalId", "type");
DROP INDEX "MediaExternalId_source_externalId_type_key";

ALTER TABLE "MessageReaction" DROP CONSTRAINT "MessageReaction_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("messageId", "userId");
DROP INDEX "MessageReaction_messageId_userId_key";

ALTER TABLE "MusicExternalId" DROP CONSTRAINT "MusicExternalId_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "MusicExternalId_pkey" PRIMARY KEY ("source", "externalId");
DROP INDEX "MusicExternalId_source_externalId_key";

ALTER TABLE "SeasonTranslation" DROP CONSTRAINT "SeasonTranslation_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "SeasonTranslation_pkey" PRIMARY KEY ("seasonId", "locale");
DROP INDEX "SeasonTranslation_seasonId_locale_key";

ALTER TABLE "VisibilitySetting" DROP CONSTRAINT "VisibilitySetting_pkey", DROP COLUMN "id",
  ADD CONSTRAINT "VisibilitySetting_pkey" PRIMARY KEY ("userId", "domain", "facet");
DROP INDEX "VisibilitySetting_userId_domain_facet_key";

-- A deletion by an admin is a deletion: deletedByAdmin never stands alone.
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_deletedByAdmin_check"
  CHECK (NOT "deletedByAdmin" OR "deletedAt" IS NOT NULL);
ALTER TABLE "Message" ADD CONSTRAINT "Message_deletedByAdmin_check"
  CHECK (NOT "deletedByAdmin" OR "deletedAt" IS NOT NULL);

-- The closed-value string columns of 20261124170000 become real enums; the
-- CHECK constraints they replace go. Converted in place: values are kept.
-- WebauthnCredential.deviceType keeps its CHECK: its values come from the
-- WebAuthn library.
CREATE TYPE "ActivityDomain" AS ENUM ('MEDIA', 'BOOKS', 'GAMES', 'MUSIC', 'PODCASTS', 'BOARDGAMES', 'LISTS');
CREATE TYPE "ActivityLevel" AS ENUM ('WORK', 'SEASON', 'EPISODE');
CREATE TYPE "RunStatus" AS ENUM ('SUCCESS', 'FAILURE');

ALTER TABLE "ActivityEvent"
  DROP CONSTRAINT "ActivityEvent_domain_check",
  DROP CONSTRAINT "ActivityEvent_level_check",
  ALTER COLUMN "level" DROP DEFAULT;
ALTER TABLE "ActivityEvent"
  ALTER COLUMN "domain" TYPE "ActivityDomain" USING "domain"::"ActivityDomain",
  ALTER COLUMN "level" TYPE "ActivityLevel" USING "level"::"ActivityLevel";
ALTER TABLE "ActivityEvent" ALTER COLUMN "level" SET DEFAULT 'WORK';

ALTER TABLE "JobRun" DROP CONSTRAINT "JobRun_status_check";
ALTER TABLE "JobRun" ALTER COLUMN "status" TYPE "RunStatus" USING "status"::"RunStatus";
ALTER TABLE "ImportRun" DROP CONSTRAINT "ImportRun_status_check";
ALTER TABLE "ImportRun" ALTER COLUMN "status" TYPE "RunStatus" USING "status"::"RunStatus";
