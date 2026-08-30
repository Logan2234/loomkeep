/* eslint-disable no-console */
/**
 * Dev-only seeder. Meant to run against an empty (freshly `migrate reset`)
 * database — it does not clean up existing rows.
 *
 * Usage: pnpm --filter @loomkeep/api exec prisma migrate reset
 * (runs the migrations then this file automatically, via the "prisma.seed"
 * entry in package.json).
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../../../.env") });

import {
  ActivityType,
  DigestCadence,
  NotificationType,
} from "@loomkeep/shared";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  CatalogSource,
  CommentEmote,
  CommentTargetType,
  Domain,
  EntryStatus,
  ExternalSource,
  FollowStatus,
  GameOwnershipStatus,
  GameSource,
  GameStatus,
  ListKind,
  ListVisibility,
  MediaOwnershipStatus,
  MediaType,
  ModerationLegalBasis,
  ModerationMeasure,
  MusicOwnershipStatus,
  MusicSource,
  MusicStatus,
  PrismaClient,
  ProfileAccess,
  ReportCategory,
  ReportMotif,
  ReportStatus,
  ReportTargetType,
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
  Role,
  SecurityEventType,
  UserTokenType,
  VisibilityAudience,
  VisibilityFacet,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";

// Same cost factor as AuthService.BCRYPT_ROUNDS (src/auth/auth.service.ts) —
// kept as a literal here since this script runs outside the Nest app.
const BCRYPT_ROUNDS = 12;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — check apps/api/.env");
}

const schema =
  new URL(connectionString).searchParams.get("schema") ?? undefined;
const adapter = new PrismaPg({ connectionString }, { schema });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------
  const [loganPassword, secondaryPassword, demoPassword] = await Promise.all([
    bcrypt.hash("Lolo2234", BCRYPT_ROUNDS),
    bcrypt.hash("Lolo2234", BCRYPT_ROUNDS),
    bcrypt.hash("Password123!", BCRYPT_ROUNDS),
  ]);

  const logan = await prisma.user.create({
    data: {
      email: "loganwi322@gmail.com",
      passwordHash: loganPassword,
      displayName: "Logan",
      username: "logan",
      birthDate: new Date("1998-03-12"),
      allowAdultContent: true,
      notifyEmail: DigestCadence.DAILY,
      notifyPush: DigestCadence.DAILY,
      notifyNewsletter: true,
      newsletterOptInAt: new Date("2026-01-05"),
      emailVerified: true,
      bio: "Créateur de Loomkeep. Séries, jeux, bouquins — un peu de tout.",
      profileAccess: ProfileAccess.PUBLIC,
      defaultReviewVisibility: ReviewVisibility.PUBLIC,
      defaultListVisibility: ListVisibility.PUBLIC,
      role: Role.ADMIN,
      enabledDomains: [Domain.MEDIA, Domain.BOOKS, Domain.GAMES, Domain.MUSIC],
      locale: "fr",
      calendarToken: randomUUID(),
      onboardedAt: new Date("2026-01-05"),
    },
  });

  const loganSfr = await prisma.user.create({
    data: {
      email: "logan.w@sfr.fr",
      passwordHash: secondaryPassword,
      displayName: "Logan (perso)",
      username: "logan-perso",
      birthDate: new Date("1998-03-12"),
      notifyEmail: DigestCadence.DAILY,
      emailVerified: true,
      bio: "Compte secondaire.",
      profileAccess: ProfileAccess.PRIVATE,
      role: Role.USER,
      enabledDomains: [Domain.MEDIA, Domain.BOOKS],
      locale: "fr",
      onboardedAt: new Date("2026-01-06"),
    },
  });

  const alice = await prisma.user.create({
    data: {
      email: "alice@example.com",
      passwordHash: demoPassword,
      displayName: "Alice Martin",
      username: "alice",
      birthDate: new Date("1995-07-20"),
      notifyEmail: DigestCadence.DISABLED,
      notifyPush: DigestCadence.DAILY,
      emailVerified: true,
      bio: "Fan de séries coréennes et de jeux indés.",
      profileAccess: ProfileAccess.PUBLIC,
      defaultReviewVisibility: ReviewVisibility.PUBLIC,
      role: Role.USER,
      enabledDomains: [Domain.MEDIA, Domain.GAMES, Domain.BOOKS, Domain.MUSIC],
      locale: "fr",
      onboardedAt: new Date("2026-02-01"),
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@example.com",
      passwordHash: demoPassword,
      displayName: "Bob Durand",
      username: "bob",
      emailVerified: false,
      profileAccess: ProfileAccess.PRIVATE,
      role: Role.USER,
      enabledDomains: [Domain.MEDIA, Domain.GAMES],
      locale: "fr",
      onboardedAt: new Date("2026-03-10"),
    },
  });

  const chloe = await prisma.user.create({
    data: {
      email: "chloe@example.com",
      passwordHash: demoPassword,
      displayName: "Chloé Petit",
      username: "chloe",
      emailVerified: true,
      profileAccess: ProfileAccess.GHOST,
      role: Role.USER,
      enabledDomains: [Domain.MEDIA, Domain.MUSIC],
      locale: "fr",
      onboardedAt: new Date("2026-04-02"),
    },
  });

  const users = [logan, loganSfr, alice, bob, chloe];

  // ---------------------------------------------------------------------
  // Visibility settings (overrides of the FRIENDS default)
  // ---------------------------------------------------------------------
  await prisma.visibilitySetting.createMany({
    data: [
      {
        userId: alice.id,
        domain: Domain.MEDIA,
        facet: VisibilityFacet.LIBRARY,
        audience: VisibilityAudience.PUBLIC,
      },
      {
        userId: bob.id,
        domain: Domain.GAMES,
        facet: VisibilityFacet.ACTIVITY,
        audience: VisibilityAudience.NONE,
      },
    ],
  });

  // ---------------------------------------------------------------------
  // Follow / Block
  // ---------------------------------------------------------------------
  await prisma.follow.createMany({
    data: [
      {
        followerId: alice.id,
        followeeId: logan.id,
        status: FollowStatus.ACCEPTED,
      },
      {
        followerId: logan.id,
        followeeId: alice.id,
        status: FollowStatus.ACCEPTED,
      },
      {
        followerId: bob.id,
        followeeId: logan.id,
        status: FollowStatus.ACCEPTED,
      },
      {
        followerId: chloe.id,
        followeeId: alice.id,
        status: FollowStatus.ACCEPTED,
      },
      // bob -> alice pending: alice is PUBLIC in this dataset, but we model
      // a still-pending request anyway (e.g. throttled/queued in real life).
      {
        followerId: bob.id,
        followeeId: alice.id,
        status: FollowStatus.PENDING,
      },
    ],
  });

  await prisma.block.create({
    data: { blockerId: alice.id, blockedId: bob.id },
  });

  // ---------------------------------------------------------------------
  // Catalogue cache: media (movies/series/anime)
  // ---------------------------------------------------------------------
  const inception = await prisma.mediaItem.create({
    data: {
      type: MediaType.MOVIE,
      canonicalSource: CatalogSource.TMDB,
      title: "Inception",
      posterUrl:
        "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
      overview:
        "Dom Cobb vole les secrets enfouis dans le subconscient durant le rêve.",
      releaseDate: new Date("2010-07-21"),
      status: "Released",
      genres: ["Science-Fiction", "Action", "Thriller"],
      runtimeMin: 148,
      externalIds: {
        create: [
          {
            source: ExternalSource.TMDB,
            externalId: "27205",
            type: MediaType.MOVIE,
          },
        ],
      },
    },
  });

  const interstellar = await prisma.mediaItem.create({
    data: {
      type: MediaType.MOVIE,
      canonicalSource: CatalogSource.TMDB,
      title: "Interstellar",
      posterUrl:
        "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      overview:
        "Un groupe d'explorateurs franchit un trou de ver pour sauver l'humanité.",
      releaseDate: new Date("2014-11-05"),
      status: "Released",
      genres: ["Science-Fiction", "Drame", "Aventure"],
      runtimeMin: 169,
      externalIds: {
        create: [
          {
            source: ExternalSource.TMDB,
            externalId: "157336",
            type: MediaType.MOVIE,
          },
        ],
      },
    },
  });

  const breakingBad = await prisma.mediaItem.create({
    data: {
      type: MediaType.SERIES,
      canonicalSource: CatalogSource.TMDB,
      title: "Breaking Bad",
      posterUrl:
        "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      overview:
        "Un prof de chimie se lance dans la fabrication de méthamphétamine.",
      releaseDate: new Date("2008-01-20"),
      status: "Ended",
      genres: ["Drame", "Crime"],
      runtimeMin: 47,
      externalIds: {
        create: [
          {
            source: ExternalSource.TMDB,
            externalId: "1396",
            type: MediaType.SERIES,
          },
        ],
      },
      seasons: {
        create: [
          {
            number: 1,
            title: "Saison 1",
            episodes: {
              create: Array.from({ length: 7 }, (_, i) => ({
                number: i + 1,
                title: `Épisode ${i + 1}`,
                airDate: new Date(2008, 0, 20 + i * 7),
              })),
            },
          },
          {
            number: 2,
            title: "Saison 2",
            episodes: {
              create: Array.from({ length: 13 }, (_, i) => ({
                number: i + 1,
                title: `Épisode ${i + 1}`,
                airDate: new Date(2009, 2, 8 + i * 7),
              })),
            },
          },
        ],
      },
    },
    include: { seasons: { include: { episodes: true } } },
  });

  const attackOnTitan = await prisma.mediaItem.create({
    data: {
      type: MediaType.ANIME,
      canonicalSource: CatalogSource.ANILIST,
      title: "L'Attaque des Titans",
      posterUrl: "https://cdn.myanimelist.net/images/anime/10/47347.jpg",
      overview:
        "L'humanité survit retranchée derrière des murs face aux Titans.",
      releaseDate: new Date("2013-04-07"),
      status: "FINISHED",
      genres: ["Action", "Drame", "Fantastique"],
      runtimeMin: 24,
      externalIds: {
        create: [
          {
            source: ExternalSource.ANILIST,
            externalId: "16498",
            type: MediaType.ANIME,
          },
        ],
      },
      seasons: {
        create: [
          {
            number: 1,
            episodes: {
              create: Array.from({ length: 12 }, (_, i) => ({
                number: i + 1,
                title: `Épisode ${i + 1}`,
                airDate: new Date(2013, 3, 7 + i * 7),
              })),
            },
          },
        ],
      },
    },
    include: { seasons: { include: { episodes: true } } },
  });

  // ---------------------------------------------------------------------
  // Catalogue cache: games / books / music
  // ---------------------------------------------------------------------
  const eldenRing = await prisma.gameItem.create({
    data: {
      canonicalSource: GameSource.IGDB,
      title: "Elden Ring",
      coverUrl:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
      overview:
        "Un action-RPG en monde ouvert imaginé par FromSoftware et George R. R. Martin.",
      releaseDate: new Date("2022-02-25"),
      genres: ["RPG", "Action"],
      platforms: ["PC", "PS5", "Xbox Series X"],
      externalIds: {
        create: [{ source: GameSource.IGDB, externalId: "119133" }],
      },
    },
  });

  const hades = await prisma.gameItem.create({
    data: {
      canonicalSource: GameSource.IGDB,
      title: "Hades",
      coverUrl:
        "https://images.igdb.com/igdb/image/upload/t_cover_big/co39hs.jpg",
      overview:
        "Un rogue-like où l'on incarne Zagreus, fils d'Hadès, fuyant les Enfers.",
      releaseDate: new Date("2020-09-17"),
      genres: ["Rogue-like", "Action"],
      platforms: ["PC", "Switch", "PS5"],
      externalIds: {
        create: [{ source: GameSource.IGDB, externalId: "113112" }],
      },
    },
  });

  const dune = await prisma.bookItem.create({
    data: {
      canonicalSource: BookSource.OPEN_LIBRARY,
      title: "Dune",
      authors: ["Frank Herbert"],
      coverUrl: "https://covers.openlibrary.org/b/id/11481354-L.jpg",
      overview: "L'épopée de Paul Atréides sur la planète désertique Arrakis.",
      releaseDate: new Date("1965-08-01"),
      genres: ["Science-Fiction"],
      pageCount: 688,
      externalIds: {
        create: [{ source: BookSource.OPEN_LIBRARY, externalId: "OL893414W" }],
      },
    },
  });

  const projectHailMary = await prisma.bookItem.create({
    data: {
      canonicalSource: BookSource.OPEN_LIBRARY,
      title: "Projet Hail Mary",
      authors: ["Andy Weir"],
      overview:
        "Un astronaute se réveille seul, amnésique, dernier espoir de l'humanité.",
      releaseDate: new Date("2021-05-04"),
      genres: ["Science-Fiction"],
      pageCount: 496,
      externalIds: {
        create: [
          { source: BookSource.OPEN_LIBRARY, externalId: "OL21745884W" },
        ],
      },
    },
  });

  const randomAccessMemories = await prisma.musicItem.create({
    data: {
      canonicalSource: MusicSource.MUSICBRAINZ,
      title: "Random Access Memories",
      artists: ["Daft Punk"],
      coverUrl: "https://coverartarchive.org/release/daft-punk-ram/front.jpg",
      releaseDate: new Date("2013-05-17"),
      genres: ["Electro", "Disco"],
      albumType: "Album",
      trackCount: 13,
      durationMin: 74,
      externalIds: {
        create: [
          {
            source: MusicSource.MUSICBRAINZ,
            externalId: "b7c1e650-bb84-4d05-8c1d-0f8f3f5f6b7a",
          },
        ],
      },
    },
  });

  const inRainbows = await prisma.musicItem.create({
    data: {
      canonicalSource: MusicSource.MUSICBRAINZ,
      title: "In Rainbows",
      artists: ["Radiohead"],
      releaseDate: new Date("2007-10-10"),
      genres: ["Rock alternatif"],
      albumType: "Album",
      trackCount: 10,
      durationMin: 42,
      externalIds: {
        create: [
          {
            source: MusicSource.MUSICBRAINZ,
            externalId: "5b11f4ce-a62d-471e-81fc-a69a8278c7da",
          },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Library entries
  // ---------------------------------------------------------------------
  await prisma.libraryEntry.create({
    data: {
      userId: logan.id,
      mediaItemId: inception.id,
      status: EntryStatus.COMPLETED,
      favorite: true,
      startedAt: new Date("2026-01-10T20:00:00Z"),
      finishedAt: new Date("2026-01-10T22:30:00Z"),
      ownershipStatus: MediaOwnershipStatus.STREAMING,
      ownershipSource: "Netflix",
    },
  });
  await prisma.libraryEntry.create({
    data: {
      userId: logan.id,
      mediaItemId: interstellar.id,
      status: EntryStatus.PLANNED,
    },
  });
  await prisma.libraryEntry.create({
    data: {
      userId: logan.id,
      mediaItemId: breakingBad.id,
      status: EntryStatus.WATCHING,
      ownershipStatus: MediaOwnershipStatus.STREAMING,
      ownershipSource: "Netflix",
      startedAt: new Date("2026-02-01T19:00:00Z"),
    },
  });
  await prisma.libraryEntry.create({
    data: {
      userId: alice.id,
      mediaItemId: attackOnTitan.id,
      status: EntryStatus.COMPLETED,
      favorite: true,
      startedAt: new Date("2025-11-01T18:00:00Z"),
      finishedAt: new Date("2025-12-20T21:00:00Z"),
    },
  });
  await prisma.libraryEntry.create({
    data: {
      userId: alice.id,
      mediaItemId: inception.id,
      status: EntryStatus.COMPLETED,
      finishedAt: new Date("2024-06-01T22:00:00Z"),
    },
  });
  await prisma.libraryEntry.create({
    data: {
      userId: bob.id,
      mediaItemId: breakingBad.id,
      status: EntryStatus.DROPPED,
      notes: "Trop lent au début, jamais repris.",
    },
  });
  await prisma.libraryEntry.create({
    data: {
      userId: chloe.id,
      mediaItemId: interstellar.id,
      status: EntryStatus.COMPLETED,
      favorite: true,
      finishedAt: new Date("2026-05-10T22:00:00Z"),
    },
  });

  // Episode watches: Logan is mid-season-1, Bob dropped after episode 3.
  const bbSeason1Episodes = breakingBad.seasons[0].episodes;

  for (const episode of bbSeason1Episodes.slice(0, 5)) {
    await prisma.episodeWatch.create({
      data: {
        userId: logan.id,
        episodeId: episode.id,
        watchedAt: episode.airDate!,
      },
    });
  }

  for (const episode of bbSeason1Episodes.slice(0, 3)) {
    await prisma.episodeWatch.create({
      data: {
        userId: bob.id,
        episodeId: episode.id,
        watchedAt: episode.airDate!,
      },
    });
  }

  // Alice rewatched the first episode of Attack on Titan (two rows = a rewatch).
  const aotFirstEpisode = attackOnTitan.seasons[0].episodes[0];
  await prisma.episodeWatch.createMany({
    data: [
      {
        userId: alice.id,
        episodeId: aotFirstEpisode.id,
        watchedAt: new Date("2025-11-01"),
      },
      {
        userId: alice.id,
        episodeId: aotFirstEpisode.id,
        watchedAt: new Date("2026-06-01"),
      },
    ],
  });

  for (const episode of attackOnTitan.seasons[0].episodes.slice(1)) {
    await prisma.episodeWatch.create({
      data: {
        userId: alice.id,
        episodeId: episode.id,
        watchedAt: episode.airDate!,
      },
    });
  }

  // Games
  const eldenRingEntryLogan = await prisma.gameEntry.create({
    data: {
      userId: logan.id,
      gameItemId: eldenRing.id,
      status: GameStatus.COMPLETED,
      favorite: true,
      playtimeMinutes: 6200,
      startedAt: new Date("2022-03-01"),
      finishedAt: new Date("2022-06-15"),
      ownershipStatus: GameOwnershipStatus.DIGITAL,
      ownershipSource: "Steam",
    },
  });
  await prisma.gameReplay.create({
    data: {
      gameEntryId: eldenRingEntryLogan.id,
      finishedAt: new Date("2023-01-20"),
    },
  });
  await prisma.gameEntry.create({
    data: {
      userId: alice.id,
      gameItemId: hades.id,
      status: GameStatus.PLAYING,
      playtimeMinutes: 1450,
      startedAt: new Date("2026-04-01"),
      ownershipStatus: GameOwnershipStatus.DIGITAL,
      ownershipSource: "Steam",
    },
  });
  await prisma.gameEntry.create({
    data: {
      userId: bob.id,
      gameItemId: eldenRing.id,
      status: GameStatus.BACKLOG,
      ownershipStatus: GameOwnershipStatus.PHYSICAL,
    },
  });

  // Books
  const duneEntryAlice = await prisma.bookEntry.create({
    data: {
      userId: alice.id,
      bookItemId: dune.id,
      status: BookStatus.READ,
      favorite: true,
      currentPage: 688,
      startedAt: new Date("2025-08-01"),
      finishedAt: new Date("2025-08-20"),
      ownershipStatus: BookOwnershipStatus.PHYSICAL,
    },
  });
  await prisma.bookReplay.create({
    data: {
      bookEntryId: duneEntryAlice.id,
      finishedAt: new Date("2026-03-01"),
    },
  });
  await prisma.bookEntry.create({
    data: {
      userId: logan.id,
      bookItemId: projectHailMary.id,
      status: BookStatus.READING,
      currentPage: 210,
      startedAt: new Date("2026-06-01"),
      ownershipStatus: BookOwnershipStatus.DIGITAL,
      ownershipSource: "Kindle",
    },
  });
  await prisma.readingGoal.createMany({
    data: [
      { userId: alice.id, year: 2026, target: 24 },
      { userId: logan.id, year: 2026, target: 12 },
    ],
  });

  // Music
  await prisma.musicEntry.create({
    data: {
      userId: logan.id,
      musicItemId: randomAccessMemories.id,
      status: MusicStatus.LISTENED,
      favorite: true,
      finishedAt: new Date("2026-01-15"),
      ownershipStatus: MusicOwnershipStatus.STREAMING,
      ownershipSource: "Spotify",
    },
  });
  await prisma.musicEntry.create({
    data: {
      userId: chloe.id,
      musicItemId: inRainbows.id,
      status: MusicStatus.TO_LISTEN,
    },
  });

  // ---------------------------------------------------------------------
  // Reviews, votes, revisions
  // ---------------------------------------------------------------------
  const inceptionReview = await prisma.review.create({
    data: {
      userId: logan.id,
      targetType: ReviewTargetType.MEDIA,
      targetId: inception.id,
      rating: 9.5,
      text: "Un classique, à revoir tous les ans.",
      visibility: ReviewVisibility.PUBLIC,
    },
  });
  await prisma.reviewRevision.create({
    data: { reviewId: inceptionReview.id, rating: 9, text: "Excellent film." },
  });
  await prisma.reviewVote.create({
    data: {
      reviewId: inceptionReview.id,
      userId: alice.id,
      value: ReviewVoteValue.UP,
    },
  });
  await prisma.reviewVote.create({
    data: {
      reviewId: inceptionReview.id,
      userId: chloe.id,
      value: ReviewVoteValue.UP,
    },
  });

  await prisma.review.create({
    data: {
      userId: alice.id,
      targetType: ReviewTargetType.MEDIA,
      targetId: attackOnTitan.id,
      rating: 10,
      text: "La meilleure conclusion d'animé que j'ai jamais vue.",
      visibility: ReviewVisibility.PUBLIC,
    },
  });

  await prisma.review.create({
    data: {
      userId: bob.id,
      targetType: ReviewTargetType.GAME,
      targetId: eldenRing.id,
      rating: 6,
      text: "Trop punitif pour moi, mais objectivement bien fait.",
      visibility: ReviewVisibility.FRIENDS,
    },
  });

  // ---------------------------------------------------------------------
  // Comments & reactions
  // ---------------------------------------------------------------------
  const breakingBadComment = await prisma.comment.create({
    data: {
      targetType: CommentTargetType.MEDIA,
      targetId: breakingBad.id,
      authorId: logan.id,
      text: "La saison 2 monte encore d'un cran, j'adore.",
    },
  });
  const breakingBadReply = await prisma.comment.create({
    data: {
      targetType: CommentTargetType.MEDIA,
      targetId: breakingBad.id,
      authorId: alice.id,
      parentId: breakingBadComment.id,
      text: "Complètement d'accord, Gus arrive et tout change.",
      spoilerTag: true,
    },
  });
  await prisma.commentReaction.createMany({
    data: [
      {
        commentId: breakingBadComment.id,
        userId: alice.id,
        emote: CommentEmote.LIKE,
      },
      {
        commentId: breakingBadComment.id,
        userId: chloe.id,
        emote: CommentEmote.LOVE,
      },
      {
        commentId: breakingBadReply.id,
        userId: logan.id,
        emote: CommentEmote.LAUGH,
      },
    ],
  });
  // A comment later taken down by admin action (see ModerationDecision below).
  const removedComment = await prisma.comment.create({
    data: {
      targetType: CommentTargetType.MEDIA,
      targetId: inception.id,
      authorId: bob.id,
      text: "[supprimé]",
      deletedAt: new Date("2026-05-02"),
      deletedByAdmin: true,
    },
  });

  // ---------------------------------------------------------------------
  // Reports & moderation
  // ---------------------------------------------------------------------
  const report = await prisma.report.create({
    data: {
      targetType: ReportTargetType.COMMENT,
      targetId: removedComment.id,
      reporterId: alice.id,
      category: ReportCategory.HARASSMENT,
      motif: ReportMotif.HARASSMENT_INSULTS,
      reason: "Commentaire insultant envers d'autres membres.",
      status: ReportStatus.RESOLVED,
      resolvedAt: new Date("2026-05-02"),
      resolvedById: logan.id,
    },
  });
  await prisma.moderationDecision.create({
    data: {
      measure: ModerationMeasure.COMMENT_REMOVED,
      targetType: ReportTargetType.COMMENT,
      targetId: removedComment.id,
      subjectUserId: bob.id,
      subjectEmail: bob.email,
      subjectUsername: bob.username,
      legalBasis: ModerationLegalBasis.TOS_BREACH,
      reasonCategory: ReportCategory.HARASSMENT,
      reasonMotif: ReportMotif.HARASSMENT_INSULTS,
      reasonText:
        "Propos insultants envers un autre membre, en violation des règles de conduite.",
      tosClause: "§7 — Règles de conduite",
      contentSnapshot: "Contenu original du commentaire avant suppression.",
      decidedById: logan.id,
      reportId: report.id,
    },
  });

  // A still-pending report with no motif yet resolved.
  await prisma.report.create({
    data: {
      targetType: ReportTargetType.COMMENT,
      targetId: breakingBadReply.id,
      reporterId: bob.id,
      category: ReportCategory.SPOILER,
      motif: ReportMotif.SPOILER_UNTAGGED,
      reason: "Spoiler non tagué sur la saison 2.",
      status: ReportStatus.PENDING,
    },
  });

  // ---------------------------------------------------------------------
  // Lists
  // ---------------------------------------------------------------------
  const topFilms = await prisma.list.create({
    data: {
      userId: alice.id,
      title: "Mes films préférés",
      description: "Le classement qui ne changera jamais (vraiment).",
      kind: ListKind.RANKED,
      visibility: ListVisibility.PUBLIC,
      items: {
        create: [
          {
            targetType: ReviewTargetType.MEDIA,
            targetId: inception.id,
            position: 0,
          },
          {
            targetType: ReviewTargetType.MEDIA,
            targetId: interstellar.id,
            position: 1,
          },
        ],
      },
      members: { create: [{ userId: logan.id }] },
    },
  });
  await prisma.list.create({
    data: {
      userId: logan.id,
      title: "À jouer un jour",
      kind: ListKind.COLLECTION,
      visibility: ListVisibility.PRIVATE,
      items: {
        create: [
          {
            targetType: ReviewTargetType.GAME,
            targetId: hades.id,
            position: 0,
          },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Push subscriptions, notifications, activity feed
  // ---------------------------------------------------------------------
  await prisma.pushSubscription.create({
    data: {
      userId: logan.id,
      endpoint: "https://fcm.googleapis.com/fcm/send/seed-endpoint-logan",
      p256dh: "seed-p256dh-key",
      auth: "seed-auth-secret",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: logan.id,
        type: NotificationType.FOLLOW,
        title: "Alice Martin vous suit désormais",
        url: "/app/u/alice",
        dedupeKey: `follow:${alice.id}`,
        data: {
          actorUsername: alice.username,
          actorDisplayName: alice.displayName,
        },
      },
      {
        userId: logan.id,
        type: NotificationType.COMMENT_REPLY,
        title: "Alice a répondu à votre commentaire",
        url: "/app/media/series/" + breakingBad.id,
        dedupeKey: `reply:${breakingBadReply.id}`,
        data: {
          actorUsername: alice.username,
          actorDisplayName: alice.displayName,
        },
      },
      {
        userId: alice.id,
        type: NotificationType.MODERATION_ACTION,
        title: "Une décision de modération vous concerne",
        data: {},
      },
    ],
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        userId: logan.id,
        type: ActivityType.FINISHED,
        domain: Domain.MEDIA,
        targetType: "MEDIA",
        targetId: inception.id,
        level: "WORK",
        homeFeed: true,
        title: inception.title,
        imageUrl: inception.posterUrl,
        href: "/app/media/movie/" + inception.id,
        data: {},
      },
      {
        userId: logan.id,
        type: ActivityType.REVIEWED,
        domain: Domain.MEDIA,
        targetType: "MEDIA",
        targetId: inception.id,
        level: "WORK",
        homeFeed: true,
        title: inception.title,
        imageUrl: inception.posterUrl,
        href: "/app/media/movie/" + inception.id,
        data: { rating: 9.5 },
      },
      {
        userId: alice.id,
        type: ActivityType.FINISHED,
        domain: Domain.MEDIA,
        targetType: "MEDIA",
        targetId: attackOnTitan.id,
        level: "WORK",
        homeFeed: true,
        title: attackOnTitan.title,
        imageUrl: attackOnTitan.posterUrl,
        href: "/app/media/anime/" + attackOnTitan.id,
        data: {},
      },
      {
        userId: alice.id,
        type: ActivityType.LIST_CREATED,
        domain: Domain.MEDIA,
        targetType: "LIST",
        targetId: topFilms.id,
        level: "WORK",
        homeFeed: false,
        title: topFilms.title,
        href: "/app/lists/" + topFilms.id,
        data: {},
      },
    ],
  });

  // ---------------------------------------------------------------------
  // Jobs, devices, sessions, security, imports, backups, newsletter, quotas
  // ---------------------------------------------------------------------
  await prisma.jobRun.createMany({
    data: [
      {
        jobKey: "notifications.scan",
        startedAt: new Date("2026-08-17T06:00:00Z"),
        finishedAt: new Date("2026-08-17T06:00:12Z"),
        status: "SUCCESS",
        summary: "3 notification(s) créée(s)",
      },
      {
        jobKey: "media.refreshStale",
        startedAt: new Date("2026-08-17T05:00:00Z"),
        finishedAt: new Date("2026-08-17T05:02:45Z"),
        status: "SUCCESS",
        summary: "2 média(s) rafraîchi(s)",
      },
      {
        jobKey: "backup.create",
        startedAt: new Date("2026-08-16T03:00:00Z"),
        finishedAt: new Date("2026-08-16T03:00:40Z"),
        status: "FAILURE",
        error: "ENOSPC: no space left on device",
      },
    ],
  });

  for (const user of users) {
    await prisma.userDevice.create({
      data: {
        userId: user.id,
        deviceKey: "Chrome sur Windows",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128",
      },
    });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(`seed-refresh-${user.id}`),
        jti: randomUUID(),
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.securityEvent.create({
      data: {
        type: SecurityEventType.USER_REGISTERED,
        userId: user.id,
        identifier: user.email,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128",
      },
    });
  }

  await prisma.securityEvent.create({
    data: {
      type: SecurityEventType.LOGIN_FAILED,
      identifier: "unknown@example.com",
      detail: "Email inconnu",
      userAgent: "curl/8.4.0",
    },
  });

  // Bob hasn't verified his email yet — a live verification token for him.
  await prisma.userToken.create({
    data: {
      userId: bob.id,
      type: UserTokenType.EMAIL_VERIFICATION,
      tokenHash: sha256("seed-email-verification-token-bob"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await prisma.emailChangeRequest.create({
    data: {
      userId: bob.id,
      newEmail: "bob.durand@example.com",
      codeHash: sha256("123456"),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await prisma.importRun.create({
    data: {
      user: { connect: { id: alice.id } },
      sourceId: "tvtime",
      status: "SUCCESS",
      itemCount: 42,
      overwrite: false,
      summary: "42 élément(s) importé(s) depuis TV Time",
      startedAt: new Date("2026-02-05T10:00:00Z"),
      finishedAt: new Date("2026-02-05T10:01:30Z"),
    },
  });

  await prisma.backupFile.createMany({
    data: [
      {
        filename: "loomkeep-2026-08-15.sql.gz",
        sizeBytes: 4_582_912,
        createdAt: new Date("2026-08-15T03:00:00Z"),
      },
      {
        filename: "loomkeep-2026-08-16.sql.gz",
        sizeBytes: 4_611_004,
        createdAt: new Date("2026-08-16T03:00:00Z"),
      },
    ],
  });

  await prisma.newsletterSend.create({
    data: {
      quackbackChangelogId: "seed-changelog-1",
      title: "Loomkeep 1.5 — imports Trakt & Simkl",
      recipientCount: 128,
      sentAt: new Date("2026-08-01T09:00:00Z"),
    },
  });

  await prisma.apiCallCounter.createMany({
    data: [
      { provider: "tmdb", day: new Date("2026-08-17T00:00:00Z"), count: 214 },
      { provider: "anilist", day: new Date("2026-08-17T00:00:00Z"), count: 37 },
      { provider: "igdb", day: new Date("2026-08-17T00:00:00Z"), count: 19 },
      {
        // Key must match what QuotaTrackerService writes, or the /admin/stats
        // row falls back to the raw provider string instead of its label.
        provider: "openLibrary",
        day: new Date("2026-08-17T00:00:00Z"),
        count: 8,
      },
    ],
  });

  console.log("Seed terminé :");
  console.log(
    `  - ${users.length} utilisateurs (dont ${logan.email} / Lolo2234)`,
  );
  console.log(`  - Bibliothèques média/jeux/livres/musique remplies`);
  console.log(
    `  - Social : follows, reviews, commentaires, signalements, listes`,
  );
  console.log(
    `  - Admin, jobs, appareils, sécurité, imports, sauvegardes peuplés`,
  );
  console.log("Comptes :");
  console.log(`  - ${logan.email} / Lolo2234 (admin)`);
  console.log(`  - ${loganSfr.email} / Lolo2234`);
  console.log(`  - ${alice.email} / Password123!`);
  console.log(`  - ${bob.email} / Password123!`);
  console.log(`  - ${chloe.email} / Password123!`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
