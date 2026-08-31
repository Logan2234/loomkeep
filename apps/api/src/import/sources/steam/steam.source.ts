import type {
  GameStatus,
  ImportMatch,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  ImportReportTile,
} from "@loomkeep/shared";
import {
  Domain,
  ErrorCode,
  GameOwnershipStatus,
  GameSource,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../../common/app.exception";
import { QuotaTrackerService } from "../../../common/quota-tracker.service";
import { GameItemService } from "../../../games/game-item.service";
import { IgdbProvider } from "../../../games/providers/igdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import { AgeGateService } from "../../../users/age-gate.service";
import type {
  CommitDecisions,
  ImportReq,
  ProgressReporter,
} from "../../import-source";

const STEAM_API = "https://api.steampowered.com";

/** Review sections, in display order, with their French headings. */
const STATUS_GROUPS: { status: GameStatus; label: string }[] = [
  { status: "PLAYING", label: "En cours" },
  { status: "BACKLOG", label: "À jouer" },
  { status: "COMPLETED", label: "Terminé" },
  { status: "DROPPED", label: "Abandonnés" },
];

interface SteamOwnedGame {
  appid: number;
  // Only present because `fetchOwnedGames` requests `include_appinfo=1`.
  name?: string;
  playtime_forever: number; // Minutes.
  playtime_2weeks?: number;
}

/**
 * Parse model carried between analyze and commit. The raw input is resolved and
 * matched during {@link buildPlan}, which stashes each item's playtime here (by
 * plan key) so {@link commit} keeps it without a second Steam round-trip.
 */
interface SteamParsed {
  rawInput: string;
  playtimeByKey: Map<string, number>;
}

/** Steam library + playtime, matched against IGDB. */
@Injectable()
export class SteamImportSource implements ImportReq<SteamParsed> {
  readonly id = "steam";
  readonly searchDomain = Domain.GAMES;
  readonly supportsOverwrite = true;
  readonly requiredEnvKeys = ["STEAM_API_KEY"];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly igdb: IgdbProvider,
    private readonly gameItemService: GameItemService,
    private readonly ageGate: AgeGateService,
    private readonly quota: QuotaTrackerService,
  ) {}

  parseInput(input: string): SteamParsed {
    return { rawInput: input.trim(), playtimeByKey: new Map() };
  }

  async buildPlan(
    userId: string,
    parsed: SteamParsed,
    progress: ProgressReporter,
  ): Promise<ImportPlan> {
    const steamId = await this.resolveSteamId(parsed.rawInput);
    const owned = await this.fetchOwnedGames(steamId);
    progress.setTotal(owned.length);

    if (owned.length === 0) {
      return {
        groups: [],
        counts: { total: 0, matched: 0, unresolved: 0, apiErrors: 0 },
        searchDomain: Domain.GAMES,
      };
    }

    const appIds = owned.map((g) => String(g.appid));
    const appToIgdb = await this.igdb.matchSteamAppIds(appIds);
    const igdbIds = [...new Set(appToIgdb.values())];
    const details = await this.igdb.getDetailsByIds(igdbIds);
    const detailById = new Map(details.map((d) => [d.summary.sourceId, d]));

    const [allowAdult, inLibrary] = await Promise.all([
      this.ageGate.allowsAdultContent(userId),
      this.igdbIdsInLibrary(userId, igdbIds),
    ]);

    // One item per matched IGDB game (highest playtime wins when several owned
    // appids resolve to the same game), plus one per game IGDB had no entry for.
    const matchedByIgdb = new Map<string, ImportPlanItem>();
    const unmatchedByApp = new Map<string, ImportPlanItem>();

    for (const game of owned) {
      const igdbId = appToIgdb.get(String(game.appid));
      const detail = igdbId ? detailById.get(igdbId) : undefined;
      progress.tick();

      if (!igdbId || !detail) {
        const key = `u${game.appid}`;
        parsed.playtimeByKey.set(key, game.playtime_forever);
        unmatchedByApp.set(key, {
          key,
          title: game.name ?? "Jeu inconnu",
          sourceTitle: game.name ?? "Jeu inconnu",
          subtitle: fmtPlaytime(game.playtime_forever),
          context: {
            kind: "game",
            playtimeMinutes: game.playtime_forever,
            recentlyPlayed: false,
            unknownTitle: game.name === undefined || game.name === null,
          },
          coverUrl: null,
          match: null,
          include: false,
          alreadyInLibrary: false,
          defaultStatus: "BACKLOG",
        });
        continue;
      }

      if (detail.summary.isAdult && !allowAdult) continue;

      const key = `g${igdbId}`;
      const recentlyPlayed = (game.playtime_2weeks ?? 0) > 0;
      const existing = matchedByIgdb.get(key);
      const playtime = Math.max(
        game.playtime_forever,
        parsed.playtimeByKey.get(key) ?? 0,
      );
      parsed.playtimeByKey.set(key, playtime);
      const recent = recentlyPlayed || existing?.defaultStatus === "PLAYING";
      const alreadyInLibrary = inLibrary.has(igdbId);

      matchedByIgdb.set(key, {
        key,
        title: detail.summary.title,
        sourceTitle: detail.summary.title,
        subtitle: fmtPlaytime(playtime) + (recent ? " · joué récemment" : ""),
        context: {
          kind: "game",
          playtimeMinutes: playtime,
          recentlyPlayed: recent,
        },
        coverUrl: detail.summary.coverUrl,
        match: toMatch(igdbId, detail.summary.title, detail.summary.coverUrl),
        include: !alreadyInLibrary,
        alreadyInLibrary,
        defaultStatus: recent ? "PLAYING" : "BACKLOG",
      });
    }

    const all = [...matchedByIgdb.values(), ...unmatchedByApp.values()];
    const byStatus = new Map<GameStatus, ImportPlanItem[]>();

    for (const item of all) {
      const s = item.defaultStatus as GameStatus;
      const bucket = byStatus.get(s) ?? [];
      bucket.push(item);
      byStatus.set(s, bucket);
    }

    // Sort each bucket by playtime, longest first (matches the old preview).
    for (const bucket of byStatus.values()) {
      bucket.sort(
        (a, b) =>
          (parsed.playtimeByKey.get(b.key) ?? 0) -
          (parsed.playtimeByKey.get(a.key) ?? 0),
      );
    }

    const groups: ImportPlanGroup[] = STATUS_GROUPS.filter(
      (g) => (byStatus.get(g.status)?.length ?? 0) > 0,
    ).map((g) => ({
      id: g.status,
      label: g.label,
      items: byStatus.get(g.status)!,
    }));

    const matched = matchedByIgdb.size;
    const unresolved = unmatchedByApp.size;
    return {
      groups,
      counts: {
        total: matched + unresolved,
        matched,
        unresolved,
        apiErrors: 0,
      },
      searchDomain: Domain.GAMES,
    };
  }

  async commit(
    userId: string,
    parsed: SteamParsed,
    plan: ImportPlan,
    decisions: CommitDecisions,
    progress: ProgressReporter,
  ): Promise<ImportReport> {
    const matchByKey = indexPlanMatches(plan);

    if (decisions.overwrite) {
      // GameReplay cascades on GameEntry delete (schema onDelete: Cascade).
      await this.prisma.gameEntry.deleteMany({ where: { userId } });
    }

    // Resolve the target ids first, then bulk-fetch their IGDB details.
    const targets: { key: string; sourceId: string }[] = [];

    for (const key of decisions.include) {
      const match = decisions.overrides.get(key) ?? matchByKey.get(key);
      if (match) targets.push({ key, sourceId: match.sourceId });
    }

    const details = await this.igdb.getDetailsByIds([
      ...new Set(targets.map((t) => t.sourceId)),
    ]);
    const detailById = new Map(details.map((d) => [d.summary.sourceId, d]));
    const allowAdult = await this.ageGate.allowsAdultContent(userId);

    const tally = new Map<GameStatus, number>();
    let totalMinutes = 0;

    for (const { key, sourceId } of targets) {
      const detail = detailById.get(sourceId);

      if (!detail || (detail.summary.isAdult && !allowAdult)) {
        progress.tick();
        continue;
      }

      const gameItem = await this.gameItemService.persistDetails(
        GameSource.IGDB,
        detail,
      );
      const status = (decisions.statuses.get(key) ?? "BACKLOG") as GameStatus;
      const playtimeMinutes = parsed.playtimeByKey.get(key) ?? 0;
      // Every Steam-imported game is, by definition, owned digitally on Steam.
      const data = {
        status,
        playtimeMinutes,
        ownershipStatus: GameOwnershipStatus.DIGITAL,
        ownershipSource: "Steam",
      };
      await this.prisma.gameEntry.upsert({
        where: { userId_gameItemId: { userId, gameItemId: gameItem.id } },
        update: data,
        create: { userId, gameItemId: gameItem.id, ...data },
      });
      tally.set(status, (tally.get(status) ?? 0) + 1);
      totalMinutes += playtimeMinutes;
      progress.tick();
    }

    const tiles: ImportReportTile[] = STATUS_GROUPS.filter(
      (g) => (tally.get(g.status) ?? 0) > 0,
    ).map((g) => ({
      id: g.status,
      label: g.label,
      value: tally.get(g.status)!,
      sub: null,
    }));
    if (tiles.length === 0)
      tiles.push({ id: "games", label: "Jeux", value: 0, sub: null });
    tiles.push({
      id: "playtime",
      label: "Temps de jeu",
      value: Math.round(totalMinutes / 60),
      sub: "heures importées",
    });

    return { overwrite: decisions.overwrite, tiles };
  }

  /** IGDB ids (of the given set) the user already has a library entry for. */
  private async igdbIdsInLibrary(
    userId: string,
    igdbIds: string[],
  ): Promise<Set<string>> {
    if (igdbIds.length === 0) return new Set();

    const refs = await this.prisma.gameExternalId.findMany({
      where: { source: "IGDB", externalId: { in: igdbIds } },
      select: { externalId: true, gameItemId: true },
    });
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId, gameItemId: { in: refs.map((r) => r.gameItemId) } },
      select: { gameItemId: true },
    });
    const owned = new Set(entries.map((e) => e.gameItemId));
    return new Set(
      refs.filter((r) => owned.has(r.gameItemId)).map((r) => r.externalId),
    );
  }

  /** SteamID64 / vanity name / profile URL → SteamID64. */
  private async resolveSteamId(rawInput: string): Promise<string> {
    const input = rawInput.trim();

    const profileMatch = input.match(/steamcommunity\.com\/profiles\/(\d{17})/);
    if (profileMatch) return profileMatch[1];

    const vanityUrlMatch = input.match(/steamcommunity\.com\/id\/([^/?#]+)/);
    const vanity = vanityUrlMatch ? vanityUrlMatch[1] : input;

    if (/^\d{17}$/.test(vanity)) return vanity;

    return this.resolveVanity(vanity);
  }

  private async resolveVanity(name: string): Promise<string> {
    const data = await this.getJson<{
      response: { success: number; steamid?: string };
    }>(`${STEAM_API}/ISteamUser/ResolveVanityURL/v1/`, { vanityurl: name });

    if (data.response.success !== 1 || !data.response.steamid) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ImportSteamProfileNotFound,
        undefined,
        "Steam profile not found — check the id or profile URL",
      );
    }

    return data.response.steamid;
  }

  private async fetchOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const data = await this.getJson<{
      response: { game_count?: number; games?: SteamOwnedGame[] };
    }>(`${STEAM_API}/IPlayerService/GetOwnedGames/v1/`, {
      steamid: steamId,
      include_played_free_games: "1",
      // Needed for `name` — used to pre-fill the manual match search for
      // games IGDB couldn't resolve on its own.
      include_appinfo: "1",
      format: "json",
    });

    // A private (or game-details-private) profile returns an empty response
    // object rather than an error.
    if (data.response.game_count === undefined) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ImportSteamLibraryPrivate,
        undefined,
        "Steam library inaccessible — the profile and game details must be public",
      );
    }

    return data.response.games ?? [];
  }

  private async getJson<T>(
    url: string,
    params: Record<string, string>,
  ): Promise<T> {
    const target = new URL(url);
    target.searchParams.set(
      "key",
      this.configService.getOrThrow<string>("STEAM_API_KEY"),
    );

    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }

    this.quota.record("steam");
    const response = await fetch(target);

    if (!response.ok) {
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.ImportSourceUnavailable,
        undefined,
        `Steam request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}

function fmtPlaytime(minutes: number): string {
  if (minutes === 0) return "jamais joué";
  const hours = Math.round(minutes / 60);
  return hours === 0 ? "< 1 h" : `${hours} h`;
}

function toMatch(
  igdbId: string,
  title: string,
  coverUrl: string | null,
): ImportMatch {
  return {
    source: GameSource.IGDB,
    sourceId: igdbId,
    title,
    year: null,
    coverUrl,
  };
}

/** Flatten a plan's auto-resolved matches into a key → match lookup. */
function indexPlanMatches(plan: ImportPlan): Map<string, ImportMatch> {
  const byKey = new Map<string, ImportMatch>();

  for (const group of plan.groups) {
    for (const item of group.items) {
      if (item.match) byKey.set(item.key, item.match);
    }
  }

  return byKey;
}
