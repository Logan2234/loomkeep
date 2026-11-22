import type { EntryStatus, MediaSummaryDto, MediaType } from "@loomkeep/shared";
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import {
  baseTitle,
  type DatedSeason,
  type EpisodeCoord,
  findAnchors,
  mapEpisodes,
  mergeStatus,
  titlesMatch,
} from "./anime-migration.util";
import { MediaItemService } from "./media-item.service";
import { TmdbProvider } from "./providers/tmdb.provider";

const OVERRIDES_FILE = "anime-migration-overrides.json";
// Candidates looked at per work: each one costs a TMDB details call.
const MAX_CANDIDATES = 6;

type Mode = "dry-run" | "apply";

/** A mapping settled by hand, for a work the matching could not place. */
interface Override {
  tmdbId: string;
  type: "ANIME" | "MOVIE";
  /** Where the work's first episode sits on TMDB (absent for a film). */
  season?: number;
  episode?: number;
  /**
   * "drop": a user who reviewed both the AniList work and the TMDB show
   * keeps the TMDB review alone.
   */
  reviewConflict?: "drop";
}

type AnilistItem = Prisma.MediaItemGetPayload<{
  include: {
    externalIds: true;
    seasons: { include: { episodes: true } };
    entries: true;
  };
}>;

interface Watch {
  id: string;
  userId: string;
  episodeId: string;
  episodeNumber: number;
}

interface Target {
  tmdbId: string;
  type: "ANIME" | "MOVIE";
  title: string;
  coords: Map<number, EpisodeCoord>;
  anchor: EpisodeCoord | null;
  reviewConflict?: "drop";
}

interface Candidate {
  tmdbId: string;
  type: MediaType;
  title: string;
  originalTitle: string | null;
  year: number | null;
  anchors?: EpisodeCoord[];
}

class ItemConflict extends Error {}

/**
 * One-off move of the anime still on AniList onto TMDB, where anime now
 * live. Runs at start-up only when ANIME_MIGRATION says so: "dry-run" writes
 * the report alone, "apply" migrates what it can place for sure. Each work
 * moves in one transaction — entries, watches, reviews, comments, list
 * items, feed and chat cards, XP anchors and notification links — without
 * awarding anything. What it can't place goes to the JSON report, with all
 * it takes to settle it by hand in anime-migration-overrides.json (next to
 * the report, in BACKUP_DIR/anime-migration) for the next run.
 */
@Injectable()
export class AnimeMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnimeMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly media: MediaItemService,
    private readonly tmdb: TmdbProvider,
  ) {}

  onApplicationBootstrap(): void {
    const mode = this.config.get<string>("ANIME_MIGRATION");
    if (mode !== "dry-run" && mode !== "apply") return;

    // In the background: the instance serves while the migration runs.
    void this.run(mode).catch((err) =>
      this.logger.error("Anime migration failed", err),
    );
  }

  async run(mode: Mode): Promise<string> {
    const dir = join(
      this.config.get<string>("BACKUP_DIR") ?? process.cwd(),
      "anime-migration",
    );
    const overrides = await this.readOverrides(dir);
    const reclassified = await this.reclassifySeries(mode);

    const items = await this.prisma.mediaItem.findMany({
      where: { canonicalSource: "ANILIST" },
      include: {
        externalIds: true,
        seasons: { include: { episodes: true } },
        entries: true,
      },
    });

    const resolved: unknown[] = [];
    const unresolved: unknown[] = [];

    for (const item of items) {
      const anilistId =
        item.externalIds.find((e) => e.source === "ANILIST")?.externalId ?? "";
      const watches = await this.watchesOf(item.id);
      const outcome = await this.place(item, watches, overrides[anilistId]);

      if ("reason" in outcome) {
        unresolved.push(
          await this.describe(
            item,
            anilistId,
            watches,
            outcome.reason,
            outcome.candidates,
          ),
        );
        continue;
      }

      let changes: { merged: number; reopened: number } | null = null;

      if (mode === "apply") {
        try {
          changes = await this.apply(item, anilistId, watches, outcome);
        } catch (err) {
          const reason =
            err instanceof ItemConflict
              ? err.message
              : `apply failed: ${(err as Error).message}`;
          unresolved.push(
            await this.describe(item, anilistId, watches, reason, []),
          );
          continue;
        }
      }

      resolved.push({
        anilistId,
        mediaItemId: item.id,
        title: item.title,
        format: item.format,
        tmdb: { id: outcome.tmdbId, type: outcome.type, title: outcome.title },
        anchor: outcome.anchor,
        users: item.entries.length,
        watches: watches.length,
        // Entries joined with the user's own on the show, and entries a
        // finished season turned back to in progress on the whole show.
        ...changes,
      });
    }

    if (mode === "apply") await this.dropAnilistSagas();

    const report = {
      generatedAt: new Date().toISOString(),
      mode,
      overridesFile: join(dir, OVERRIDES_FILE),
      summary: {
        anilistWorks: items.length,
        [mode === "apply" ? "migrated" : "placeable"]: resolved.length,
        unresolved: unresolved.length,
        seriesReclassifiedAsAnime: reclassified.length,
      },
      reclassified,
      resolved,
      unresolved,
    };
    await mkdir(dir, { recursive: true });
    const file = join(
      dir,
      `anime-migration-${mode}-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(file, JSON.stringify(report, null, 2));
    this.logger.log(
      `Anime migration (${mode}): ${resolved.length}/${items.length} placed, ${unresolved.length} left, ${reclassified.length} series reclassified — report at ${file}`,
    );
    return file;
  }

  private async readOverrides(dir: string): Promise<Record<string, Override>> {
    const path = join(dir, OVERRIDES_FILE);
    if (!existsSync(path)) return {};
    return JSON.parse(await readFile(path, "utf8")) as Record<string, Override>;
  }

  /** TMDB series tracked before anime moved to TMDB: the ones it calls anime. */
  private async reclassifySeries(
    mode: Mode,
  ): Promise<{ tmdbId: string; title: string }[]> {
    const series = await this.prisma.mediaItem.findMany({
      where: { canonicalSource: "TMDB", type: "SERIES" },
      select: {
        id: true,
        externalIds: {
          where: { source: "TMDB" },
          select: { externalId: true },
        },
      },
    });
    const reclassified: { tmdbId: string; title: string }[] = [];

    for (const item of series) {
      const tmdbId = item.externalIds[0]?.externalId;
      if (!tmdbId) continue;
      let summary: MediaSummaryDto;

      try {
        summary = await this.tmdb.getSeriesSummaryByTmdbId(tmdbId);
      } catch {
        continue;
      }

      if (summary.type !== "ANIME") continue;
      reclassified.push({ tmdbId, title: summary.title });

      if (mode === "apply") {
        await this.prisma.$transaction([
          this.prisma.mediaItem.update({
            where: { id: item.id },
            data: { type: "ANIME" },
          }),
          this.prisma.mediaExternalId.updateMany({
            where: { mediaItemId: item.id },
            data: { type: "ANIME" },
          }),
        ]);
      }
    }

    return reclassified;
  }

  private async watchesOf(mediaItemId: string): Promise<Watch[]> {
    const rows = await this.prisma.episodeWatch.findMany({
      where: { episode: { season: { mediaItemId } } },
      select: {
        id: true,
        userId: true,
        episodeId: true,
        episode: { select: { number: true } },
      },
    });
    return rows.map((w) => ({
      id: w.id,
      userId: w.userId,
      episodeId: w.episodeId,
      episodeNumber: w.episode.number,
    }));
  }

  /** Where the work goes on TMDB, or why it can't be said for sure. */
  private async place(
    item: AnilistItem,
    watches: Watch[],
    override: Override | undefined,
  ): Promise<Target | { reason: string; candidates: Candidate[] }> {
    const episodes = item.seasons
      .flatMap((s) => s.episodes)
      .sort((a, b) => a.number - b.number);
    const mustMap = new Set(watches.map((w) => w.episodeNumber));
    const start =
      item.releaseDate ?? episodes.find((e) => e.airDate)?.airDate ?? null;

    if (override) {
      if (override.type === "MOVIE") {
        return {
          tmdbId: override.tmdbId,
          type: "MOVIE",
          title: item.title,
          coords: new Map(),
          anchor: null,
          reviewConflict: override.reviewConflict,
        };
      }

      const anchor = {
        season: override.season ?? 1,
        episode: override.episode ?? 1,
      };
      const seasons = await this.tmdbSeasons(override.tmdbId);
      const mapping = mapEpisodes(seasons, anchor, episodes, mustMap);
      return mapping.ok
        ? {
            tmdbId: override.tmdbId,
            type: "ANIME",
            title: item.title,
            coords: mapping.coords,
            anchor,
            reviewConflict: override.reviewConflict,
          }
        : { reason: `override: ${mapping.reason}`, candidates: [] };
    }

    const titles = [item.title];
    const found = await this.search(titles);

    if (item.format === "MOVIE") {
      const year = start?.getUTCFullYear() ?? null;
      const films = found.filter(
        (c) =>
          c.type === "MOVIE" &&
          titlesMatch(titles, [c.title, c.originalTitle]) &&
          year !== null &&
          c.year !== null &&
          Math.abs(c.year - year) <= 1,
      );

      if (films.length !== 1) {
        return {
          reason:
            films.length === 0
              ? "no TMDB film matches"
              : "several TMDB films match",
          candidates: found.filter((c) => c.type === "MOVIE"),
        };
      }

      return {
        tmdbId: films[0].tmdbId,
        type: "MOVIE",
        title: films[0].title,
        coords: new Map(),
        anchor: null,
      };
    }

    if (!start) {
      return { reason: "no start date to anchor on", candidates: found };
    }

    const shows = found
      .filter(
        (c) =>
          c.type === "ANIME" && titlesMatch(titles, [c.title, c.originalTitle]),
      )
      .slice(0, MAX_CANDIDATES);
    const placements: {
      candidate: Candidate;
      anchor: EpisodeCoord;
      seasons: DatedSeason[];
    }[] = [];

    for (const candidate of shows) {
      const seasons = await this.tmdbSeasons(candidate.tmdbId);
      candidate.anchors = findAnchors(seasons, start);

      for (const anchor of candidate.anchors) {
        placements.push({ candidate, anchor, seasons });
      }
    }

    if (placements.length !== 1) {
      return {
        reason:
          placements.length === 0
            ? shows.length === 0
              ? "no TMDB anime with a matching title"
              : "no TMDB episode aired on the start date"
            : "several TMDB episodes aired on the start date",
        candidates: shows.length > 0 ? shows : found,
      };
    }

    const [{ candidate, anchor, seasons }] = placements;
    const mapping = mapEpisodes(seasons, anchor, episodes, mustMap);
    if (!mapping.ok) return { reason: mapping.reason, candidates: shows };

    return {
      tmdbId: candidate.tmdbId,
      type: "ANIME",
      title: candidate.title,
      coords: mapping.coords,
      anchor,
    };
  }

  private async search(titles: (string | null)[]): Promise<Candidate[]> {
    const queries = [
      ...new Set(
        titles
          .filter((t): t is string => !!t)
          .flatMap((t) => [t, baseTitle(t)])
          .filter((t) => t.length > 0),
      ),
    ];
    const byId = new Map<string, Candidate>();

    for (const query of queries) {
      for (const s of await this.tmdb.search(query, "ANIME")) {
        const key = `${s.type}:${s.sourceId}`;
        if (byId.has(key)) continue;
        byId.set(key, {
          tmdbId: s.sourceId,
          type: s.type,
          title: s.title,
          originalTitle: s.originalTitle ?? null,
          year: s.year,
        });
      }
    }

    return [...byId.values()];
  }

  private async tmdbSeasons(tmdbId: string): Promise<DatedSeason[]> {
    const details = await this.tmdb.getDetails(tmdbId, "ANIME");
    return details.seasons.map((s) => ({
      number: s.number,
      episodes: s.episodes.map((e) => ({
        number: e.number,
        airDate: e.airDate ? new Date(e.airDate) : null,
      })),
    }));
  }

  /** Everything a later session needs to settle the work without the database. */
  private async describe(
    item: AnilistItem,
    anilistId: string,
    watches: Watch[],
    reason: string,
    candidates: Candidate[],
  ) {
    const [reviews, comments, listItems] = await Promise.all([
      this.prisma.review.findMany({
        where: { targetType: "MEDIA", targetId: item.id },
        select: { userId: true, rating: true, text: true },
      }),
      this.prisma.comment.count({
        where: { targetType: "MEDIA", targetId: item.id },
      }),
      this.prisma.listItem.count({
        where: { targetType: "MEDIA", targetId: item.id },
      }),
    ]);

    return {
      anilistId,
      anilistUrl: `https://anilist.co/anime/${anilistId}`,
      mediaItemId: item.id,
      title: item.title,
      format: item.format,
      status: item.status,
      startDate: item.releaseDate?.toISOString().slice(0, 10) ?? null,
      episodes: item.seasons
        .flatMap((s) => s.episodes)
        .sort((a, b) => a.number - b.number)
        .map((e) => ({
          number: e.number,
          airDate: e.airDate?.toISOString() ?? null,
        })),
      entries: item.entries.map((e) => ({
        userId: e.userId,
        status: e.status,
        watchedEpisodes: watches
          .filter((w) => w.userId === e.userId)
          .map((w) => w.episodeNumber)
          .sort((a, b) => a - b),
      })),
      reviews,
      comments,
      listItems,
      reason,
      candidates,
      overrideExample: {
        [anilistId]: {
          tmdbId: "<TMDB id>",
          type: "ANIME",
          season: 1,
          episode: 1,
          reviewConflict: "drop (only if a review clash is the reason)",
        },
      },
    };
  }

  private async apply(
    item: AnilistItem,
    anilistId: string,
    watches: Watch[],
    target: Target,
  ): Promise<{ merged: number; reopened: number }> {
    // The TMDB copy, seasons and episodes included, before the transaction:
    // fetching it can take seconds.
    const created = await this.media.upsertFromSource(
      "TMDB",
      target.tmdbId,
      target.type,
    );
    const stored = await this.prisma.season.findMany({
      where: { mediaItemId: created.id },
      select: {
        id: true,
        number: true,
        episodes: { select: { id: true, number: true } },
      },
    });
    const episodeIdAt = (c: EpisodeCoord) =>
      stored
        .find((s) => s.number === c.season)
        ?.episodes.find((e) => e.number === c.episode)?.id;
    const oldHref = `/app/media/anime/${anilistId}`;
    const newHref = `/app/media/${created.type.toLowerCase()}/${target.tmdbId}`;

    const episodeMap = new Map<string, string>();

    for (const season of item.seasons) {
      for (const episode of season.episodes) {
        const coord = target.coords.get(episode.number);
        const id = coord && episodeIdAt(coord);
        if (id) episodeMap.set(episode.id, id);
      }
    }

    const anchorSeasonId =
      target.anchor &&
      stored.find((s) => s.number === target.anchor!.season)?.id;
    const seasonMap = new Map(
      anchorSeasonId
        ? item.seasons.map((s) => [s.id, anchorSeasonId] as const)
        : [],
    );

    return this.prisma.$transaction(
      async (tx) => {
        const entryMap = new Map<string, string>();
        const users = item.entries.map((e) => e.userId);

        // A film has no episodes: its entry's status says it was seen. Gone
        // before the entry moves, so the progress trigger recounts the entry.
        await tx.episodeWatch.deleteMany({
          where: {
            id: {
              in: watches
                .filter((w) => !episodeMap.has(w.episodeId))
                .map((w) => w.id),
            },
          },
        });

        for (const entry of item.entries) {
          const existing = await tx.libraryEntry.findUnique({
            where: {
              userId_mediaItemId: {
                userId: entry.userId,
                mediaItemId: created.id,
              },
            },
          });

          if (!existing) {
            await tx.libraryEntry.update({
              where: { id: entry.id },
              data: { mediaItemId: created.id },
            });
            continue;
          }

          entryMap.set(entry.id, existing.id);
          const status = mergeStatus(existing.status, entry.status);
          await tx.libraryEntry.update({
            where: { id: existing.id },
            data: {
              status,
              finishedAt:
                status === "COMPLETED"
                  ? latest(existing.finishedAt, entry.finishedAt)
                  : null,
              favorite: existing.favorite || entry.favorite,
              notes:
                [existing.notes, entry.notes]
                  .filter((n) => n?.trim())
                  .join("\n\n") || null,
              startedAt: earliest(existing.startedAt, entry.startedAt),
            },
          });
        }

        for (const watch of watches) {
          const episodeId = episodeMap.get(watch.episodeId);

          if (episodeId) {
            await tx.episodeWatch.update({
              where: { id: watch.id },
              data: { episodeId },
            });
          }
        }

        await this.settleReviewClashes(
          tx,
          item.id,
          created.id,
          target.anchor?.episode === 1
            ? (anchorSeasonId ?? undefined)
            : undefined,
          target.reviewConflict,
        );
        await this.remapTargets(
          tx,
          "MEDIA",
          new Map([[item.id, created.id]]),
          users,
          newHref,
          created.type,
        );
        await this.remapTargets(
          tx,
          "SEASON",
          seasonMap,
          users,
          newHref,
          created.type,
        );
        await this.remapTargets(
          tx,
          "EPISODE",
          episodeMap,
          users,
          newHref,
          created.type,
        );
        await this.remapXp(tx, "Season", seasonMap);
        await this.remapXp(tx, "LibraryEntry", entryMap);
        await this.remapLinks(tx, users, oldHref, newHref, episodeMap);

        await tx.mediaExternalId.updateMany({
          where: { mediaItemId: item.id, source: "ANILIST" },
          data: { mediaItemId: created.id, type: created.type },
        });
        await tx.libraryEntry.deleteMany({
          where: { id: { in: [...entryMap.keys()] } },
        });
        await tx.mediaItem.delete({ where: { id: item.id } });

        // A cour done doesn't make the whole show done.
        const reopened = await this.reopenUnfinished(tx, created.id, users);
        return { merged: entryMap.size, reopened };
      },
      { timeout: 60_000 },
    );
  }

  /**
   * A user who reviewed both the AniList work and the TMDB show: the AniList
   * review becomes the season's when the work is that season (its first
   * episode is the season's), or goes when the override says so.
   */
  private async settleReviewClashes(
    tx: Prisma.TransactionClient,
    from: string,
    to: string,
    seasonId: string | undefined,
    conflict: "drop" | undefined,
  ): Promise<void> {
    const reviews = await tx.review.findMany({
      where: { targetType: "MEDIA", targetId: from },
      select: { id: true, userId: true },
    });

    for (const review of reviews) {
      if (!review.userId) continue;
      const clash = await tx.review.count({
        where: { targetType: "MEDIA", targetId: to, userId: review.userId },
      });
      if (clash === 0) continue;

      const seasonFree =
        seasonId !== undefined &&
        (await tx.review.count({
          where: {
            targetType: "SEASON",
            targetId: seasonId,
            userId: review.userId,
          },
        })) === 0;

      if (seasonFree) {
        await tx.review.update({
          where: { id: review.id },
          data: { targetType: "SEASON", targetId: seasonId },
        });
      } else if (conflict === "drop") {
        await tx.review.delete({ where: { id: review.id } });
      } else {
        throw new ItemConflict(
          `user ${review.userId} reviewed both this work and the TMDB show (${to})`,
        );
      }
    }
  }

  private async remapTargets(
    tx: Prisma.TransactionClient,
    targetType: "MEDIA" | "SEASON" | "EPISODE",
    ids: Map<string, string>,
    users: string[],
    newHref: string,
    workType: string,
  ): Promise<void> {
    for (const [from, to] of ids) {
      const reviews = await tx.review.findMany({
        where: { targetType, targetId: from },
        select: { userId: true },
      });
      const clash = await tx.review.count({
        where: {
          targetType,
          targetId: to,
          userId: { in: reviews.flatMap((r) => (r.userId ? [r.userId] : [])) },
        },
      });

      if (clash > 0) {
        throw new ItemConflict(
          `a user already reviewed the TMDB ${targetType.toLowerCase()} (${to})`,
        );
      }

      await tx.review.updateMany({
        where: { targetType, targetId: from },
        data: { targetId: to },
      });
      await tx.comment.updateMany({
        where: { targetType, targetId: from },
        data: { targetId: to },
      });

      const reads = await tx.commentThreadRead.findMany({
        where: { targetType, targetId: to, userId: { in: users } },
        select: { userId: true },
      });
      await tx.commentThreadRead.deleteMany({
        where: {
          targetType,
          targetId: from,
          userId: { in: reads.map((r) => r.userId) },
        },
      });
      await tx.commentThreadRead.updateMany({
        where: { targetType, targetId: from },
        data: { targetId: to },
      });

      const lists = await tx.listItem.findMany({
        where: { targetType, targetId: to },
        select: { listId: true },
      });
      await tx.listItem.deleteMany({
        where: {
          targetType,
          targetId: from,
          listId: { in: lists.map((l) => l.listId) },
        },
      });
      await tx.listItem.updateMany({
        where: { targetType, targetId: from },
        data: { targetId: to },
      });

      await tx.messageEmbed.updateMany({
        where: { targetType, targetId: from },
        data: {
          targetId: to,
          href: newHref,
          ...(targetType === "MEDIA" && { kind: workType }),
        },
      });

      if (targetType === "MEDIA") {
        await tx.activityEvent.updateMany({
          where: { targetType: "MEDIA", targetId: from },
          data: { targetId: to, href: newHref },
        });
      }
    }
  }

  /** XP stays anchored to the rows it was earned on, so it is never earned twice. */
  private async remapXp(
    tx: Prisma.TransactionClient,
    sourceType: string,
    ids: Map<string, string>,
  ): Promise<void> {
    for (const [from, to] of ids) {
      const rows = await tx.xpEntry.findMany({
        where: { sourceType, sourceId: from },
        select: { id: true, userId: true, reason: true },
      });

      for (const row of rows) {
        const taken = await tx.xpEntry.count({
          where: {
            userId: row.userId,
            reason: row.reason,
            sourceType,
            sourceId: to,
            revokedAt: null,
          },
        });

        if (taken === 0) {
          await tx.xpEntry.update({
            where: { id: row.id },
            data: { sourceId: to },
          });
        }
      }
    }
  }

  /**
   * Notification and XP links to the old page. Only the work's own users',
   * and only the exact old address: an anime TMDB id can be another work's
   * AniList id.
   */
  private async remapLinks(
    tx: Prisma.TransactionClient,
    users: string[],
    oldHref: string,
    newHref: string,
    episodeMap: Map<string, string>,
  ): Promise<void> {
    for (const [from, to] of episodeMap) {
      const rows = await tx.notification.findMany({
        where: { dedupeKey: `episode:${from}` },
        select: { id: true, userId: true },
      });

      for (const row of rows) {
        const taken = await tx.notification.count({
          where: { userId: row.userId, dedupeKey: `episode:${to}` },
        });
        await (taken > 0
          ? tx.notification.delete({ where: { id: row.id } })
          : tx.notification.update({
              where: { id: row.id },
              data: { dedupeKey: `episode:${to}`, url: newHref },
            }));
      }
    }

    await tx.notification.updateMany({
      where: { userId: { in: users }, url: oldHref },
      data: { url: newHref },
    });
    await tx.xpEntry.updateMany({
      where: { userId: { in: users }, href: oldHref },
      data: { href: newHref },
    });
  }

  private async reopenUnfinished(
    tx: Prisma.TransactionClient,
    mediaItemId: string,
    users: string[],
  ): Promise<number> {
    const aired = await tx.episode.count({
      where: {
        season: { mediaItemId, number: { gt: 0 } },
        airDate: { lte: new Date() },
      },
    });
    const done = await tx.libraryEntry.findMany({
      where: { mediaItemId, userId: { in: users }, status: "COMPLETED" },
      select: { id: true, watchedEpisodes: true },
    });

    const unfinished = done.filter((e) => e.watchedEpisodes < aired);

    for (const entry of unfinished) {
      await tx.libraryEntry.update({
        where: { id: entry.id },
        data: { status: "WATCHING" satisfies EntryStatus, finishedAt: null },
      });
    }

    return unfinished.length;
  }

  /** AniList main lines are no sagas any more: TMDB has collections of films only. */
  private async dropAnilistSagas(): Promise<void> {
    await this.prisma.mediaItem.updateMany({
      where: { sagaKey: { startsWith: "ANILIST:" } },
      data: { sagaKey: null },
    });
    await this.prisma.saga.deleteMany({
      where: { key: { startsWith: "ANILIST:" } },
    });
  }
}

function earliest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function latest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
