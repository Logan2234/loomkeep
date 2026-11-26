import type {
  ImportMatch,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  ImportReportTile,
} from "@loomkeep/shared";
import { Domain, ErrorCode, GameSource, GameStatus } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../../common/app.exception";
import { HTTP_TIMEOUT_MS } from "../../../common/http.util";
import { GameEntryImportWriter } from "../../../games/game-entry-import.writer";
import { GameItemService } from "../../../games/game-item.service";
import { IgdbProvider } from "../../../games/providers/igdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import { QuotaTrackerService } from "../../../quota/quota-tracker.service";
import { AgeGateService } from "../../../users/age-gate.service";
import {
  type CommitDecisions,
  type ImportReq,
  type ProgressReporter,
  indexPlanMatches,
  indexPlanStatuses,
  pickStatus,
} from "../../import-source";

export const STEAM_API = "https://api.steampowered.com";

/** Review sections, in display order: the client labels each status. */
const STATUS_GROUPS: GameStatus[] = [
  "PLAYING",
  "BACKLOG",
  "COMPLETED",
  "DROPPED",
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
  ) {
    this.gameWriter = new GameEntryImportWriter(prisma);
  }

  /** The games module's write: an import never writes its tables itself. */
  private readonly gameWriter: GameEntryImportWriter;

  parseInput(input: string): SteamParsed {
    return { rawInput: steamProfileRef(input), playtimeByKey: new Map() };
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
          // Steam names nothing for a delisted app: the client shows it as
          // unknown (`unknownTitle`), the app id still tells it apart.
          title: game.name ?? `Steam ${game.appid}`,
          sourceTitle: game.name ?? `Steam ${game.appid}`,
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

    const groups: ImportPlanGroup[] = STATUS_GROUPS.flatMap((status) => {
      const items = byStatus.get(status);
      return items?.length ? [{ id: status, items }] : [];
    });

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
    const proposed = indexPlanStatuses(plan);

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
    let notFound = 0;

    for (const { key, sourceId } of targets) {
      const detail = detailById.get(sourceId);

      // IGDB answered without this id: it no longer has the game. Reported,
      // not dropped in silence (an IGDB outage fails the whole fetch above).
      if (!detail) {
        notFound++;
        progress.tick();
        continue;
      }

      if (detail.summary.isAdult && !allowAdult) {
        progress.tick();
        continue;
      }

      const gameItem = await this.gameItemService.persistDetails(
        GameSource.IGDB,
        detail,
      );
      const status = pickStatus(
        GameStatus,
        GameStatus.BACKLOG,
        decisions.statuses.get(key),
        proposed.get(key),
      );
      const playtimeMinutes = parsed.playtimeByKey.get(key) ?? 0;
      await this.gameWriter.syncSteamGame(userId, gameItem.id, {
        status,
        playtimeMinutes,
        syncedAt: new Date(),
      });
      tally.set(status, (tally.get(status) ?? 0) + 1);
      totalMinutes += playtimeMinutes;
      progress.tick();
    }

    const tiles: ImportReportTile[] = STATUS_GROUPS.flatMap((status) => {
      const value = tally.get(status);
      return value !== undefined && value > 0 ? [{ id: status, value }] : [];
    });
    if (tiles.length === 0) tiles.push({ id: "games", value: 0 });
    if (notFound > 0) tiles.push({ id: "notFound", value: notFound });
    tiles.push({ id: "playtime", value: Math.round(totalMinutes / 60) });

    return { overwrite: false, tiles };
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

  /** SteamID64 or custom URL name (see steamProfileRef) → SteamID64. */
  private async resolveSteamId(ref: string): Promise<string> {
    return STEAM_ID.test(ref) ? ref : this.resolveVanity(ref);
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
    const response = await fetch(target, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });

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

const STEAM_ID = /^\d{17}$/;
// Steam's custom profile URLs: letters, digits, "_" and "-".
const VANITY_NAME = /^[A-Za-z0-9_-]{2,32}$/;
const PROFILE_URL =
  /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(profiles|id)\/([^/?#]+)\/?(?:[?#].*)?$/i;

/**
 * The profile the user named: a SteamID64, a custom URL name, or either as a
 * steamcommunity.com profile URL. Anything else is refused before Steam is
 * called. Owning the profile is not checked (Steam offers no such proof
 * without OpenID): a public library can be imported by anyone who names it.
 */
function steamProfileRef(input: string): string {
  const value = input.trim();
  const url = value.match(PROFILE_URL);
  const kind = url ? url[1].toLowerCase() : null;
  const ref = url ? url[2] : value;

  if (kind !== "id" && STEAM_ID.test(ref)) return ref;
  if (kind !== "profiles" && VANITY_NAME.test(ref)) return ref;

  throw new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.ImportSteamProfileNotFound,
  );
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
