-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'SERIES', 'ANIME');

-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('MEDIA', 'BOOKS', 'GAMES', 'MUSIC', 'PODCASTS', 'BOARDGAMES');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProfileAccess" AS ENUM ('PUBLIC', 'PRIVATE', 'GHOST');

-- CreateEnum
CREATE TYPE "VisibilityAudience" AS ENUM ('PUBLIC', 'FRIENDS', 'NONE');

-- CreateEnum
CREATE TYPE "VisibilityFacet" AS ENUM ('LIBRARY', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('MEDIA', 'SEASON', 'EPISODE', 'GAME', 'BOOK', 'MUSIC');

-- CreateEnum
CREATE TYPE "ReviewVisibility" AS ENUM ('FRIENDS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "CommentTargetType" AS ENUM ('MEDIA', 'SEASON', 'EPISODE', 'GAME', 'BOOK', 'MUSIC');

-- CreateEnum
CREATE TYPE "CommentEmote" AS ENUM ('LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'DISLIKE');

-- CreateEnum
CREATE TYPE "ReviewVoteValue" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('COMMENT', 'REVIEW', 'USER', 'LIST');

-- CreateEnum
CREATE TYPE "ListKind" AS ENUM ('RANKED', 'COLLECTION');

-- CreateEnum
CREATE TYPE "ListVisibility" AS ENUM ('PRIVATE', 'FRIENDS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('TMDB', 'ANILIST');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('TMDB', 'ANILIST', 'TVDB', 'IMDB');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('WATCHING', 'COMPLETED', 'PLANNED', 'DROPPED', 'UP_TO_DATE');

-- CreateEnum
CREATE TYPE "MediaOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED');

-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('IGDB');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('BACKLOG', 'PLAYING', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "GameOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'SUBSCRIPTION', 'BORROWED');

-- CreateEnum
CREATE TYPE "BookSource" AS ENUM ('GOOGLE_BOOKS');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('TO_READ', 'READING', 'READ', 'DROPPED');

-- CreateEnum
CREATE TYPE "BookOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'AUDIO', 'BORROWED');

-- CreateEnum
CREATE TYPE "MusicSource" AS ENUM ('MUSICBRAINZ');

-- CreateEnum
CREATE TYPE "MusicStatus" AS ENUM ('TO_LISTEN', 'LISTENED');

-- CreateEnum
CREATE TYPE "MusicOwnershipStatus" AS ENUM ('NONE', 'PHYSICAL', 'DIGITAL', 'STREAMING', 'BORROWED');

-- CreateEnum
CREATE TYPE "UserTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('USER_REGISTERED', 'USER_DELETED', 'EMAIL_CHANGED', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'LOGIN_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "allowAdultContent" BOOLEAN NOT NULL DEFAULT false,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifyPush" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "profileAccess" "ProfileAccess" NOT NULL DEFAULT 'PRIVATE',
    "defaultReviewVisibility" "ReviewVisibility" NOT NULL DEFAULT 'FRIENDS',
    "defaultListVisibility" "ListVisibility" NOT NULL DEFAULT 'PRIVATE',
    "entitlements" JSONB NOT NULL DEFAULT '[]',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "enabledDomains" "Domain"[] DEFAULT ARRAY['MEDIA', 'BOOKS', 'GAMES', 'MUSIC']::"Domain"[],
    "mobileNavShortcuts" TEXT[] DEFAULT ARRAY['home', 'search', 'menu', 'calendar', 'account']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilitySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "facet" "VisibilityFacet" NOT NULL,
    "audience" "VisibilityAudience" NOT NULL,

    CONSTRAINT "VisibilitySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    "status" "FollowStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "text" TEXT,
    "visibility" "ReviewVisibility" NOT NULL DEFAULT 'FRIENDS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" "ReviewVoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRevision" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "targetType" "CommentTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "text" TEXT,
    "spoilerTag" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emote" "CommentEmote" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ListKind" NOT NULL,
    "visibility" "ListVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NEW_EPISODE',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "dedupeKey" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'WORK',
    "homeFeed" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "href" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "userId" TEXT,
    "identifier" TEXT NOT NULL,
    "detail" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "identifier" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "overwrite" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCallCounter" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiCallCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "canonicalSource" "CatalogSource" NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "status" TEXT,
    "genres" TEXT[],
    "runtimeMin" INTEGER,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaExternalId" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "source" "ExternalSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,

    CONSTRAINT "MediaExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "airDate" TIMESTAMP(3),

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "MediaOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "GameSource" NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "platforms" TEXT[],
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameExternalId" (
    "id" TEXT NOT NULL,
    "gameItemId" TEXT NOT NULL,
    "source" "GameSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "GameExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameItemId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'BACKLOG',
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "playtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "GameOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameReplay" (
    "id" TEXT NOT NULL,
    "gameEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "BookSource" NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "coverUrl" TEXT,
    "overview" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "pageCount" INTEGER,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookExternalId" (
    "id" TEXT NOT NULL,
    "bookItemId" TEXT NOT NULL,
    "source" "BookSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "BookExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookItemId" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'TO_READ',
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "BookOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookReplay" (
    "id" TEXT NOT NULL,
    "bookEntryId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookReplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicItem" (
    "id" TEXT NOT NULL,
    "canonicalSource" "MusicSource" NOT NULL,
    "title" TEXT NOT NULL,
    "artists" TEXT[],
    "coverUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "genres" TEXT[],
    "albumType" TEXT,
    "trackCount" INTEGER,
    "durationMin" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicExternalId" (
    "id" TEXT NOT NULL,
    "musicItemId" TEXT NOT NULL,
    "source" "MusicSource" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "MusicExternalId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "musicItemId" TEXT NOT NULL,
    "status" "MusicStatus" NOT NULL DEFAULT 'TO_LISTEN',
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "ownershipStatus" "MusicOwnershipStatus" NOT NULL DEFAULT 'NONE',
    "ownershipSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilitySetting_userId_domain_facet_key" ON "VisibilitySetting"("userId", "domain", "facet");

-- CreateIndex
CREATE INDEX "Follow_followeeId_status_idx" ON "Follow"("followeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followeeId_key" ON "Follow"("followerId", "followeeId");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "Review_targetType_targetId_idx" ON "Review"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_targetType_targetId_key" ON "Review"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVote_reviewId_userId_key" ON "ReviewVote"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "ReviewRevision_reviewId_createdAt_idx" ON "ReviewRevision"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_targetType_targetId_createdAt_idx" ON "Comment"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_commentId_userId_key" ON "CommentReaction"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "List_userId_idx" ON "List"("userId");

-- CreateIndex
CREATE INDEX "ListItem_listId_position_idx" ON "ListItem"("listId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listId_targetType_targetId_key" ON "ListItem"("listId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_homeFeed_createdAt_idx" ON "ActivityEvent"("homeFeed", "createdAt");

-- CreateIndex
CREATE INDEX "JobRun_jobKey_startedAt_idx" ON "JobRun"("jobKey", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_jti_key" ON "RefreshToken"("jti");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserToken_userId_type_idx" ON "UserToken"("userId", "type");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE INDEX "ImportRun_sourceId_startedAt_idx" ON "ImportRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ImportRun_userId_idx" ON "ImportRun"("userId");

-- CreateIndex
CREATE INDEX "BackupFile_createdAt_idx" ON "BackupFile"("createdAt");

-- CreateIndex
CREATE INDEX "ApiCallCounter_provider_idx" ON "ApiCallCounter"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCallCounter_provider_day_key" ON "ApiCallCounter"("provider", "day");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_codeHash_key" ON "EmailChangeRequest"("codeHash");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "MediaExternalId_mediaItemId_idx" ON "MediaExternalId"("mediaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaExternalId_source_externalId_type_key" ON "MediaExternalId"("source", "externalId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Season_mediaItemId_number_key" ON "Season"("mediaItemId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_seasonId_number_key" ON "Episode"("seasonId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_userId_mediaItemId_key" ON "LibraryEntry"("userId", "mediaItemId");

-- CreateIndex
CREATE INDEX "EpisodeWatch_userId_episodeId_idx" ON "EpisodeWatch"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "GameExternalId_gameItemId_idx" ON "GameExternalId"("gameItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GameExternalId_source_externalId_key" ON "GameExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEntry_userId_gameItemId_key" ON "GameEntry"("userId", "gameItemId");

-- CreateIndex
CREATE INDEX "GameReplay_gameEntryId_idx" ON "GameReplay"("gameEntryId");

-- CreateIndex
CREATE INDEX "BookExternalId_bookItemId_idx" ON "BookExternalId"("bookItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BookExternalId_source_externalId_key" ON "BookExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BookEntry_userId_bookItemId_key" ON "BookEntry"("userId", "bookItemId");

-- CreateIndex
CREATE INDEX "BookReplay_bookEntryId_idx" ON "BookReplay"("bookEntryId");

-- CreateIndex
CREATE INDEX "MusicExternalId_musicItemId_idx" ON "MusicExternalId"("musicItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicExternalId_source_externalId_key" ON "MusicExternalId"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicEntry_userId_musicItemId_key" ON "MusicEntry"("userId", "musicItemId");

-- AddForeignKey
ALTER TABLE "VisibilitySetting" ADD CONSTRAINT "VisibilitySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaExternalId" ADD CONSTRAINT "MediaExternalId_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameExternalId" ADD CONSTRAINT "GameExternalId_gameItemId_fkey" FOREIGN KEY ("gameItemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEntry" ADD CONSTRAINT "GameEntry_gameItemId_fkey" FOREIGN KEY ("gameItemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReplay" ADD CONSTRAINT "GameReplay_gameEntryId_fkey" FOREIGN KEY ("gameEntryId") REFERENCES "GameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookExternalId" ADD CONSTRAINT "BookExternalId_bookItemId_fkey" FOREIGN KEY ("bookItemId") REFERENCES "BookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookEntry" ADD CONSTRAINT "BookEntry_bookItemId_fkey" FOREIGN KEY ("bookItemId") REFERENCES "BookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookReplay" ADD CONSTRAINT "BookReplay_bookEntryId_fkey" FOREIGN KEY ("bookEntryId") REFERENCES "BookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicExternalId" ADD CONSTRAINT "MusicExternalId_musicItemId_fkey" FOREIGN KEY ("musicItemId") REFERENCES "MusicItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicEntry" ADD CONSTRAINT "MusicEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicEntry" ADD CONSTRAINT "MusicEntry_musicItemId_fkey" FOREIGN KEY ("musicItemId") REFERENCES "MusicItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

