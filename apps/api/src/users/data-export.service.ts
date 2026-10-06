import type {
  SavedViewDomain,
  SavedViewFiltersDto,
  UserDataExportDto,
} from "@loomkeep/shared";
import { ErrorCode, ReviewTargetType } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { toUserDto } from "../auth/auth.service";
import { AppException } from "../common/app.exception";
import {
  canonicalExternalId,
  toExternalIdDtos,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";

/**
 * Builds the full portable data dump (GDPR "download my data"). Shared by the
 * self-service export (`UsersController.exportData`, always the caller's own
 * account) and the admin-triggered export (`AdminUsersController`, any account) so
 * the two never drift out of sync.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
  ) {}

  async buildExport(userId: string): Promise<UserDataExportDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
        undefined,
        "User not found",
      );
    }

    const [
      entries,
      watches,
      gameEntries,
      bookEntries,
      musicEntries,
      notifications,
      reviewRows,
      reviewVoteRows,
      commentRows,
      commentReactionRows,
      conversationRows,
      listRows,
      listMemberRows,
      followingRows,
      followerRows,
      blockingRows,
      reportRows,
      moderationDecisionRows,
      securityEventRows,
      deviceRows,
      visibilitySettingRows,
      entitlementRow,
      subscriptionRows,
      readingGoalRows,
      importRunRows,
      savedViewRows,
    ] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: { userId },
        include: {
          mediaItem: { include: { externalIds: true } },
          replays: { orderBy: { finishedAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.episodeWatch.findMany({
        where: { userId },
        include: {
          episode: {
            include: {
              season: {
                include: { mediaItem: { include: { externalIds: true } } },
              },
            },
          },
        },
        orderBy: { watchedAt: "asc" },
      }),
      this.prisma.gameEntry.findMany({
        where: { userId },
        include: {
          gameItem: { include: { externalIds: true } },
          playthroughs: { orderBy: { number: "asc" } },
          sessions: {
            orderBy: { occurredAt: "asc" },
            include: { playthrough: { select: { number: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.bookEntry.findMany({
        where: { userId },
        include: {
          bookItem: { include: { externalIds: true } },
          readings: { orderBy: { number: "asc" } },
          sessions: {
            orderBy: { occurredAt: "asc" },
            include: { reading: { select: { number: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.musicEntry.findMany({
        where: { userId },
        include: { musicItem: { include: { externalIds: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.review.findMany({
        where: { userId },
        include: { revisions: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.reviewVote.findMany({
        where: { userId },
        include: { review: { select: { targetType: true, targetId: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.comment.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.commentReaction.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.conversationMember.findMany({
        where: { userId },
        orderBy: { joinedAt: "asc" },
        select: {
          mutedAt: true,
          conversation: {
            select: {
              members: {
                select: { userId: true, user: { select: { username: true } } },
              },
              messages: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      }),
      this.prisma.list.findMany({
        where: { userId },
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.listMember.findMany({
        where: { userId },
        include: {
          list: {
            select: { title: true, user: { select: { username: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: { followee: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.follow.findMany({
        where: { followeeId: userId },
        include: { follower: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        include: { blocked: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.report.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.moderationDecision.findMany({
        where: { subjectUserId: userId },
        orderBy: { decidedAt: "asc" },
      }),
      this.prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.userDevice.findMany({
        where: { userId },
        orderBy: { firstSeenAt: "asc" },
      }),
      this.prisma.visibilitySetting.findMany({ where: { userId } }),
      this.prisma.userEntitlement.upsert({
        where: { userId },
        create: { userId },
        update: {},
      }),
      this.prisma.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.readingGoal.findMany({
        where: { userId },
        orderBy: { year: "asc" },
      }),
      this.prisma.importRun.findMany({
        where: { userId },
        orderBy: { startedAt: "asc" },
      }),
      this.prisma.savedView.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Selected field by field: the key hash, the passkey's public key and the
    // push endpoint are credentials, not personal data to hand over.
    const [
      activityRows,
      score,
      xpRows,
      achievementRows,
      apiKeyRows,
      passkeyRows,
      pushRows,
      listItemAddedRows,
      timer,
      sessionRows,
      pendingEmailChange,
      invitation,
      muteRows,
    ] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          type: true,
          domain: true,
          title: true,
          href: true,
          createdAt: true,
        },
      }),
      this.prisma.userScore.findUnique({
        where: { userId },
        select: { xp: true },
      }),
      this.prisma.xpEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          reason: true,
          amount: true,
          createdAt: true,
          revokedAt: true,
        },
      }),
      this.prisma.userAchievement.findMany({
        where: { userId },
        orderBy: { unlockedAt: "asc" },
        select: { key: true, unlockedAt: true },
      }),
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          suffix: true,
          scopes: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.webauthnCredential.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          deviceType: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
      this.prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { userAgent: true, createdAt: true },
      }),
      this.prisma.listItem.findMany({
        where: { addedById: userId, list: { userId: { not: userId } } },
        orderBy: { addedAt: "asc" },
        select: {
          targetType: true,
          targetId: true,
          addedAt: true,
          list: {
            select: { title: true, user: { select: { username: true } } },
          },
        },
      }),
      this.prisma.sessionTimer.findUnique({
        where: { userId },
        select: {
          domain: true,
          startedAt: true,
          pausedAt: true,
          accumulatedSeconds: true,
          gameEntry: { select: { gameItem: { select: { title: true } } } },
          bookEntry: { select: { bookItem: { select: { title: true } } } },
        },
      }),
      this.prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          userAgent: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.emailChangeRequest.findFirst({
        where: { userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { newEmail: true, expiresAt: true },
      }),
      this.prisma.invitation.findFirst({
        where: { redeemedBy: { some: { id: userId } } },
        select: { label: true, createdBy: { select: { displayName: true } } },
      }),
      this.prisma.listNotificationMute.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, list: { select: { title: true } } },
      }),
    ]);

    const reviewTargetTitles = await this.resolveReviewTargetTitles([
      ...reviewRows.map((r) => ({
        targetType: r.targetType,
        targetId: r.targetId,
      })),
      ...reviewVoteRows.map((v) => ({
        targetType: v.review.targetType,
        targetId: v.review.targetId,
      })),
    ]);

    // Ratings now live in Review; project them back into the export.
    const [mediaRatings, gameRatings, bookRatings, musicRatings] =
      await Promise.all([
        this.reviews.getRatings(
          userId,
          ReviewTargetType.MEDIA,
          entries.map((e) => e.mediaItemId),
        ),
        this.reviews.getRatings(
          userId,
          ReviewTargetType.GAME,
          gameEntries.map((e) => e.gameItemId),
        ),
        this.reviews.getRatings(
          userId,
          ReviewTargetType.BOOK,
          bookEntries.map((e) => e.bookItemId),
        ),
        this.reviews.getRatings(
          userId,
          ReviewTargetType.MUSIC,
          musicEntries.map((e) => e.musicItemId),
        ),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      account: toUserDto(user),
      accountRecord: {
        termsAcceptedAt: user.acceptedTermsAt?.toISOString() ?? null,
        ageCertifiedAt: user.certifiedAgeAt?.toISOString() ?? null,
        newsletterOptInAt: user.newsletterOptInAt?.toISOString() ?? null,
        lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
        suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
        equippedBadgeKeys: user.equippedBadgeKeys ?? [],
        avatar:
          user.avatar && user.avatarMimeType
            ? {
                mimeType: user.avatarMimeType,
                base64: Buffer.from(user.avatar).toString("base64"),
              }
            : null,
        pendingEmailChange: pendingEmailChange
          ? {
              newEmail: pendingEmailChange.newEmail,
              expiresAt: pendingEmailChange.expiresAt.toISOString(),
            }
          : null,
        invitation: invitation
          ? {
              label: invitation.label,
              invitedBy: invitation.createdBy?.displayName ?? null,
            }
          : null,
      },
      library: entries.map((entry) => ({
        media: {
          type: entry.mediaItem.type,
          title: entry.mediaItem.title,
          canonicalSource: entry.mediaItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.mediaItem,
            entry.mediaItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.mediaItem.externalIds),
        },
        status: entry.status,
        rating: mediaRatings.get(entry.mediaItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: entry.replays.map((replay) => replay.finishedAt.toISOString()),
      })),
      episodeWatches: watches.map((watch) => {
        const media = watch.episode.season.mediaItem;
        return {
          media: {
            type: media.type,
            title: media.title,
            sourceId: canonicalExternalId(media, media.externalIds),
          },
          seasonNumber: watch.episode.season.number,
          episodeNumber: watch.episode.number,
          episodeTitle: watch.episode.title,
          watchedAt: watch.watchedAt?.toISOString() ?? null,
        };
      }),
      games: gameEntries.map((entry) => ({
        game: {
          title: entry.gameItem.title,
          canonicalSource: entry.gameItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.gameItem,
            entry.gameItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.gameItem.externalIds),
        },
        status: entry.status,
        rating: gameRatings.get(entry.gameItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        playtimeMinutes: entry.playtimeMinutes,
        trackedPlaytimeMinutes: entry.trackedPlaytimeMinutes,
        steamPlaytimeMinutes: entry.steamPlaytimeMinutes,
        steamSyncedAt: entry.steamSyncedAt?.toISOString() ?? null,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: laterCompletions(entry.playthroughs),
        playthroughs: entry.playthroughs.map((playthrough) => ({
          number: playthrough.number,
          status: playthrough.status,
          startedAt: playthrough.startedAt?.toISOString() ?? null,
          finishedAt: playthrough.finishedAt?.toISOString() ?? null,
          trackedMinutes: playthrough.trackedMinutes,
        })),
        sessions: entry.sessions.map((session) => ({
          durationMinutes: session.durationMinutes,
          notes: session.notes,
          occurredAt: session.occurredAt.toISOString(),
          source: session.source,
          createdAt: session.createdAt.toISOString(),
          playthroughNumber: session.playthrough?.number ?? null,
        })),
      })),
      books: bookEntries.map((entry) => ({
        book: {
          title: entry.bookItem.title,
          authors: entry.bookItem.authors,
          canonicalSource: entry.bookItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.bookItem,
            entry.bookItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.bookItem.externalIds),
        },
        status: entry.status,
        rating: bookRatings.get(entry.bookItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        currentPage: entry.currentPage,
        editionKey: entry.editionKey,
        referencePageCount: entry.referencePageCount,
        trackedReadingMinutes: entry.trackedReadingMinutes,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: laterCompletions(entry.readings),
        readings: entry.readings.map((reading) => ({
          number: reading.number,
          status: reading.status,
          editionKey: reading.editionKey,
          referencePageCount: reading.referencePageCount,
          currentPage: reading.currentPage,
          pagesRead: reading.pagesRead,
          trackedMinutes: reading.trackedMinutes,
          startedAt: reading.startedAt?.toISOString() ?? null,
          finishedAt: reading.finishedAt?.toISOString() ?? null,
        })),
        sessions: entry.sessions.map((session) => ({
          durationMinutes: session.durationMinutes,
          pagesRead: session.pagesRead,
          startPage: session.startPage,
          endPage: session.endPage,
          notes: session.notes,
          occurredAt: session.occurredAt.toISOString(),
          source: session.source,
          createdAt: session.createdAt.toISOString(),
          readingNumber: session.reading?.number ?? null,
        })),
      })),
      music: musicEntries.map((entry) => ({
        album: {
          title: entry.musicItem.title,
          artists: entry.musicItem.artists,
          canonicalSource: entry.musicItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.musicItem,
            entry.musicItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.musicItem.externalIds),
        },
        status: entry.status,
        rating: musicRatings.get(entry.musicItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      // Reserved keys for the planned podcasts/board-games domains — no backing
      // tables yet, so always empty (keeps the export shape stable ahead of P3).
      podcasts: [],
      boardGames: [],
      notifications: notifications.map((n) => ({
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url,
        data: (n.data ?? {}) as Record<string, unknown>,
        createdAt: n.createdAt.toISOString(),
      })),
      reviews: reviewRows.map((r) => ({
        targetType: r.targetType as ReviewTargetType,
        targetId: r.targetId,
        targetTitle:
          reviewTargetTitles.get(`${r.targetType}:${r.targetId}`) ?? null,
        rating: r.rating,
        text: r.text,
        visibility: r.visibility,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        revisions: r.revisions.map((rev) => ({
          rating: rev.rating,
          text: rev.text,
          createdAt: rev.createdAt.toISOString(),
        })),
      })),
      reviewVotes: reviewVoteRows.map((v) => ({
        targetType: v.review.targetType as ReviewTargetType,
        targetId: v.review.targetId,
        value: v.value,
        createdAt: v.createdAt.toISOString(),
      })),
      comments: commentRows.map((c) => ({
        targetType: c.targetType,
        targetId: c.targetId,
        parentId: c.parentId,
        text: c.text,
        spoilerTag: c.spoilerTag,
        edited: c.edited,
        deletedAt: c.deletedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      commentReactions: commentReactionRows.map((r) => ({
        commentId: r.commentId,
        emote: r.emote,
        createdAt: r.createdAt.toISOString(),
      })),
      conversations: conversationRows.map((c) => ({
        peerUsername:
          c.conversation.members.find((m) => m.userId !== userId)?.user
            .username ?? null,
        muted: c.mutedAt !== null,
        messages: c.conversation.messages.map((m) => ({
          mine: m.authorId === userId,
          text: m.text,
          spoiler: m.spoiler,
          edited: m.edited,
          deletedAt: m.deletedAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
      })),
      lists: listRows.map((l) => ({
        title: l.title,
        description: l.description,
        kind: l.kind,
        visibility: l.visibility,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        items: l.items.map((i) => ({
          targetType: i.targetType as ReviewTargetType,
          targetId: i.targetId,
          position: i.position,
          addedAt: i.addedAt.toISOString(),
        })),
      })),
      listMemberships: listMemberRows.map((m) => ({
        listTitle: m.list.title,
        listOwnerUsername: m.list.user.username,
        createdAt: m.createdAt.toISOString(),
      })),
      follows: {
        following: followingRows.map((f) => ({
          username: f.followee.username,
          status: f.status,
          createdAt: f.createdAt.toISOString(),
        })),
        followers: followerRows.map((f) => ({
          username: f.follower.username,
          status: f.status,
          createdAt: f.createdAt.toISOString(),
        })),
      },
      blocks: {
        blocking: blockingRows.map((b) => ({
          username: b.blocked.username,
          createdAt: b.createdAt.toISOString(),
        })),
      },
      reports: reportRows.map((r) => ({
        targetType: r.targetType,
        category: r.category,
        motif: r.motif,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
      moderationDecisions: moderationDecisionRows.map((m) => ({
        measure: m.measure,
        targetType: m.targetType,
        legalBasis: m.legalBasis,
        reasonCategory: m.reasonCategory,
        reasonMotif: m.reasonMotif,
        reasonText: m.reasonText,
        contentSnapshot: m.contentSnapshot,
        decidedAt: m.decidedAt.toISOString(),
      })),
      securityEvents: securityEventRows.map((s) => ({
        type: s.type,
        identifier: s.identifier ?? user.email,
        detail: s.detail,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
      })),
      devices: deviceRows.map((d) => ({
        deviceKey: d.deviceKey,
        userAgent: d.userAgent,
        firstSeenAt: d.firstSeenAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
      })),
      visibilitySettings: visibilitySettingRows.map((v) => ({
        domain: v.domain,
        facet: v.facet,
        audience: v.audience,
      })),
      entitlement: {
        plan: entitlementRow.plan,
        source: entitlementRow.source,
        grantedAt: entitlementRow.grantedAt?.toISOString() ?? null,
        expiresAt: entitlementRow.expiresAt?.toISOString() ?? null,
        overrides: (entitlementRow.overrides ?? {}) as Record<string, unknown>,
      },
      subscriptions: subscriptionRows.map((s) => ({
        provider: s.provider,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        canceledAt: s.canceledAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      readingGoals: readingGoalRows.map((g) => ({
        year: g.year,
        target: g.target,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
      importRuns: importRunRows.map((i) => ({
        sourceId: i.sourceId,
        status: i.status,
        itemCount: i.itemCount,
        overwrite: i.overwrite,
        summary: i.summary,
        error: i.error,
        startedAt: i.startedAt.toISOString(),
        finishedAt: i.finishedAt.toISOString(),
      })),
      savedViews: savedViewRows.map((v) => ({
        id: v.id,
        name: v.name,
        domain: v.domain as SavedViewDomain,
        filters: v.filters as SavedViewFiltersDto,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      activity: activityRows.map((event) => ({
        type: event.type,
        domain: event.domain,
        title: event.title,
        href: event.href,
        createdAt: event.createdAt.toISOString(),
      })),
      progression: {
        xp: score?.xp ?? 0,
        xpEntries: xpRows.map((entry) => ({
          reason: entry.reason,
          amount: entry.amount,
          createdAt: entry.createdAt.toISOString(),
          revokedAt: entry.revokedAt?.toISOString() ?? null,
        })),
        achievements: achievementRows.map((achievement) => ({
          key: achievement.key,
          unlockedAt: achievement.unlockedAt.toISOString(),
        })),
      },
      apiKeys: apiKeyRows.map((key) => ({
        name: key.name,
        suffix: key.suffix,
        scopes: key.scopes,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
      })),
      passkeys: passkeyRows.map((passkey) => ({
        name: passkey.name,
        deviceType: passkey.deviceType,
        createdAt: passkey.createdAt.toISOString(),
        lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
      })),
      pushSubscriptions: pushRows.map((subscription) => ({
        userAgent: subscription.userAgent,
        createdAt: subscription.createdAt.toISOString(),
      })),
      listItemsAdded: listItemAddedRows.map((item) => ({
        listTitle: item.list.title,
        listOwnerUsername: item.list.user.username,
        targetType: item.targetType as ReviewTargetType,
        targetId: item.targetId,
        addedAt: item.addedAt.toISOString(),
      })),
      sessionTimer: timer
        ? {
            domain: timer.domain,
            title:
              timer.gameEntry?.gameItem.title ??
              timer.bookEntry?.bookItem.title ??
              null,
            startedAt: timer.startedAt.toISOString(),
            pausedAt: timer.pausedAt?.toISOString() ?? null,
            accumulatedSeconds: timer.accumulatedSeconds,
          }
        : null,
      sessions: sessionRows.map((session) => ({
        userAgent: session.userAgent,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      })),
      listMutes: muteRows.map((mute) => ({
        listTitle: mute.list.title,
        mutedAt: mute.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Best-effort title lookup for review/vote targets, batched per catalogue
   * table. SEASON/EPISODE targets (not creatable from the UI yet) resolve to
   * null, same as unknown/removed items.
   */
  private async resolveReviewTargetTitles(
    targets: { targetType: string; targetId: string }[],
  ): Promise<Map<string, string>> {
    const idsByType = new Map<string, Set<string>>();

    for (const t of targets) {
      const set = idsByType.get(t.targetType) ?? new Set<string>();
      set.add(t.targetId);
      idsByType.set(t.targetType, set);
    }

    const map = new Map<string, string>();
    const mediaIds = [...(idsByType.get(ReviewTargetType.MEDIA) ?? [])];
    const gameIds = [...(idsByType.get(ReviewTargetType.GAME) ?? [])];
    const bookIds = [...(idsByType.get(ReviewTargetType.BOOK) ?? [])];
    const musicIds = [...(idsByType.get(ReviewTargetType.MUSIC) ?? [])];

    const [mediaItems, gameItems, bookItems, musicItems] = await Promise.all([
      mediaIds.length
        ? this.prisma.mediaItem.findMany({
            where: { id: { in: mediaIds } },
            select: { id: true, title: true },
          })
        : [],
      gameIds.length
        ? this.prisma.gameItem.findMany({
            where: { id: { in: gameIds } },
            select: { id: true, title: true },
          })
        : [],
      bookIds.length
        ? this.prisma.bookItem.findMany({
            where: { id: { in: bookIds } },
            select: { id: true, title: true },
          })
        : [],
      musicIds.length
        ? this.prisma.musicItem.findMany({
            where: { id: { in: musicIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    for (const i of mediaItems)
      map.set(`${ReviewTargetType.MEDIA}:${i.id}`, i.title);
    for (const i of gameItems)
      map.set(`${ReviewTargetType.GAME}:${i.id}`, i.title);
    for (const i of bookItems)
      map.set(`${ReviewTargetType.BOOK}:${i.id}`, i.title);
    for (const i of musicItems)
      map.set(`${ReviewTargetType.MUSIC}:${i.id}`, i.title);

    return map;
  }
}

/** Completion dates of the cycles after the first: the export's `replays`. */
function laterCompletions(
  cycles: { number: number; status: string; finishedAt: Date | null }[],
): string[] {
  return cycles.flatMap((cycle) =>
    cycle.number > 1 && cycle.status === "COMPLETED" && cycle.finishedAt
      ? [cycle.finishedAt.toISOString()]
      : [],
  );
}
