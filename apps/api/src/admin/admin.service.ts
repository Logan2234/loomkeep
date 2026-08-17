import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  QuotaWindow,
  SchemaGraphResponseDto,
  ServiceArea,
  ServiceStatusDto,
  ServiceStatusResponseDto,
} from "@loomkeep/shared";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ProviderQuotaSpec } from "./admin-system-stats.util";

// docs/ is gitignored and regenerated locally (`prisma generate` for the ERD,
// `pnpm --filter @loomkeep/api run graph` for the module graph). process.cwd()
// is apps/api in both dev (pnpm --filter) and the Docker image (WORKDIR).
const DOCS_DIR = join(process.cwd(), "..", "..", "docs");

/** Strips the ```mermaid fence a generated doc wraps its diagram in. */
function extractMermaid(markdown: string): string {
  return markdown
    .replace(/^```mermaid\n/, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** Abort a probe after this delay so one dead service can't stall the page. */
const PROBE_TIMEOUT_MS = 5_000;

interface ServiceSpec {
  key: string;
  label: string;
  area: ServiceArea;
  required: boolean;
  /** Env var(s) that must all be set for the service to be configured. */
  envKeys: string[];
  /** Where to obtain the missing key/credentials, shown when unconfigured. */
  keyUrl?: string;
  /**
   * Planned-but-unbuilt provider (podcasts, board games): listed so its area
   * appears on the services page, but never probed and reported as "coming soon".
   */
  comingSoon?: boolean;
  /**
   * Live probe. Resolves to `true`/`false` when it ran, or `null` when there's
   * nothing cheap to ping (only the config presence is reported). Receives the
   * abort signal so the request is bounded by {@link PROBE_TIMEOUT_MS}.
   */
  probe?: (signal: AbortSignal) => Promise<boolean>;
  /**
   * Documented free-tier quota, when publicly known; absent otherwise (and for
   * `webPush`, which makes no outbound calls at all — see {@link QuotaTrackerService}).
   */
  quotaLimit?: { max: number; window: QuotaWindow };
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

@Injectable()
export class AdminService {
  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  private get specs(): ServiceSpec[] {
    return [
      {
        key: "tmdb",
        label: "TMDB",
        area: "Vidéo",
        required: true,
        envKeys: ["TMDB_API_TOKEN"],
        keyUrl: "https://www.themoviedb.org/settings/api",
        probe: (signal) =>
          this.ping("https://api.themoviedb.org/3/configuration", {
            signal,
            headers: {
              Authorization: `Bearer ${this.env("TMDB_API_TOKEN")}`,
            },
          }),
      },
      {
        // Keyless fallback: search still works for anime without any credentials.
        key: "anilist",
        label: "AniList",
        area: "Vidéo",
        required: false,
        envKeys: [],
        probe: (signal) =>
          this.ping("https://graphql.anilist.co", {
            signal,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{__typename}" }),
          }),
      },
      {
        key: "omdb",
        label: "OMDb (notes)",
        area: "Vidéo",
        required: false,
        envKeys: ["OMDB_API_KEY"],
        keyUrl: "https://www.omdbapi.com/apikey.aspx",
        probe: (signal) =>
          this.ping(
            `https://www.omdbapi.com/?apikey=${this.env("OMDB_API_KEY")}&i=tt0111161`,
            { signal },
          ),
        // https://www.omdbapi.com/apikey.aspx — free tier: 1,000 requests/day.
        quotaLimit: { max: 1000, window: "day" },
      },
      {
        key: "igdb",
        label: "IGDB (Twitch)",
        area: "Jeux",
        required: true,
        envKeys: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
        keyUrl: "https://dev.twitch.tv/console/apps",
        // Exchanging the client credentials validates both the reachability of
        // Twitch's OAuth endpoint and that the secret pair is accepted.
        probe: (signal) =>
          this.ping(
            "https://id.twitch.tv/oauth2/token" +
              `?client_id=${this.env("TWITCH_CLIENT_ID")}` +
              `&client_secret=${this.env("TWITCH_CLIENT_SECRET")}` +
              "&grant_type=client_credentials",
            { signal, method: "POST" },
          ),
      },
      {
        key: "steam",
        label: "Steam",
        area: "Jeux",
        required: false,
        envKeys: ["STEAM_API_KEY"],
        keyUrl: "https://steamcommunity.com/dev/apikey",
        // Keyless health endpoint: reports Steam reachability independent of the
        // key (the key only gates the actual import).
        probe: (signal) =>
          this.ping(
            "https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/",
            { signal },
          ),
        // https://steamcommunity.com/dev/apiterms §2 — 100,000 calls/day.
        quotaLimit: { max: 100_000, window: "day" },
      },
      {
        key: "simkl",
        label: "Simkl (import)",
        area: "Vidéo",
        required: false,
        envKeys: ["SIMKL_CLIENT_ID", "SIMKL_CLIENT_SECRET"],
        keyUrl: "https://simkl.com/settings/developer/",
        // Only checks the client id (reachability + key validity) — the
        // secret is only ever used in the OAuth token exchange itself, which
        // needs an interactive user consent and can't be probed in the
        // background.
        probe: (signal) =>
          this.ping(
            `https://api.simkl.com/anime/airing?client_id=${this.env("SIMKL_CLIENT_ID")}`,
            { signal },
          ),
        // Limited to 1,000 requests/day.
        quotaLimit: { max: 1000, window: "day" },
      },
      {
        key: "googleBooks",
        label: "Google Books",
        area: "Livres",
        required: true,
        envKeys: ["GOOGLE_BOOKS_API_KEY"],
        keyUrl:
          "https://console.cloud.google.com/apis/library/books.googleapis.com",
        probe: (signal) =>
          this.ping(
            "https://www.googleapis.com/books/v1/volumes?q=isbn:9780262033848" +
              `&key=${this.env("GOOGLE_BOOKS_API_KEY")}`,
            { signal },
          ),
        // https://developers.google.com/books/pricing — free tier: 1,000 requests/day.
        quotaLimit: { max: 1000, window: "day" },
      },
      {
        // Keyless (like AniList), but the sole music source — so it's required
        // for the Musique area even though there's no key to be missing.
        key: "musicbrainz",
        label: "MusicBrainz",
        area: "Musique",
        required: true,
        envKeys: [],
        probe: (signal) =>
          this.ping(
            "https://musicbrainz.org/ws/2/release-group/?query=test&fmt=json&limit=1",
            {
              signal,
              headers: {
                "User-Agent": `Loomkeep/1.0 (${this.env("MUSICBRAINZ_CONTACT") || "self-hosted, no contact provided"})`,
              },
            },
          ),
      },
      {
        key: "smtp",
        label: "SMTP (email)",
        area: "Système",
        required: false,
        envKeys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
        keyUrl: "https://www.brevo.com",
        probe: () => this.mail.verifyConnection(),
        // https://www.brevo.com free plan: 300 emails/day (see README "Email").
        quotaLimit: { max: 300, window: "day" },
      },
      {
        // No external to ping: presence of the VAPID key pair is the signal.
        key: "webPush",
        label: "Web Push (VAPID)",
        area: "Système",
        required: false,
        envKeys: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      },
      // Planned P3 providers — no integration yet, surfaced as "coming soon" so
      // their areas already show on the page. Keep to sources we'd build against.
      {
        key: "podcastindex",
        label: "Podcast Index",
        area: "Podcasts",
        required: false,
        envKeys: [],
        keyUrl: "https://podcastindex.org/",
        comingSoon: true,
      },
      {
        key: "applePodcasts",
        label: "Apple Podcasts (iTunes Search)",
        area: "Podcasts",
        required: false,
        envKeys: [],
        comingSoon: true,
      },
      {
        key: "boardgamegeek",
        label: "BoardGameGeek",
        area: "Jeux de société",
        required: false,
        envKeys: [],
        keyUrl: "https://boardgamegeek.com/wiki/page/BGG_XML_API2",
        comingSoon: true,
      },
    ];
  }

  /** Reads the two locally-generated architecture diagrams, `null` when absent. */
  async getSchemaGraphs(): Promise<SchemaGraphResponseDto> {
    const [erd, modules] = await Promise.all([
      this.readGraph("erd.md"),
      this.readGraph("modules.md"),
    ]);
    return { erd, modules };
  }

  private async readGraph(filename: string): Promise<string | null> {
    try {
      const raw = await readFile(join(DOCS_DIR, filename), "utf-8");
      return extractMermaid(raw);
    } catch {
      return null;
    }
  }

  /**
   * Label + documented daily quota of every live provider, keyed by the string
   * `QuotaTrackerService.record()` writes. Exposed so the /admin/stats
   * "Système" section can name and rate its call counters without redeclaring
   * the quotas that {@link specs} already holds.
   */
  getProviderQuotaSpecs(): ProviderQuotaSpec[] {
    return this.specs
      .filter((spec) => !spec.comingSoon)
      .map((spec) => ({
        key: spec.key,
        label: spec.label,
        dailyLimit:
          spec.quotaLimit?.window === "day" ? spec.quotaLimit.max : null,
      }));
  }

  async getServicesStatus(): Promise<ServiceStatusResponseDto> {
    const now = new Date();
    const monthStart = startOfUtcMonth(now);
    const callRows = await this.prisma.apiCallCounter.findMany({
      where: { day: { gte: monthStart } },
    });

    const services = await Promise.all(
      this.specs.map((spec) => this.evaluate(spec, now, callRows)),
    );
    return { services, checkedAt: now.toISOString() };
  }

  private async evaluate(
    spec: ServiceSpec,
    now: Date,
    callRows: { provider: string; day: Date; count: number }[],
  ): Promise<ServiceStatusDto> {
    // A planned provider has no integration to configure or probe — report it
    // as such and skip everything below (quota rows never exist for it).
    if (spec.comingSoon) {
      return {
        key: spec.key,
        label: spec.label,
        area: spec.area,
        required: false,
        configured: false,
        reachable: null,
        comingSoon: true,
        keyUrl: spec.keyUrl,
      };
    }

    const configured = spec.envKeys.every((k) => Boolean(this.env(k)));
    const quota = this.quotaFieldsFor(spec, now, callRows);

    // Don't probe a service we know isn't configured — a required key/secret is
    // missing, so a live call would only ever confirm the obvious failure.
    if (!configured && spec.envKeys.length > 0) {
      return {
        key: spec.key,
        label: spec.label,
        area: spec.area,
        required: spec.required,
        configured: false,
        reachable: null,
        detail: "Clé absente",
        keyUrl: spec.keyUrl,
        ...quota,
      };
    }

    let reachable: boolean | null = null;
    let detail: string | undefined;
    let latencyMs: number | undefined;

    if (spec.probe) {
      const start = Date.now();

      try {
        reachable = await this.withTimeout(spec.probe);
        latencyMs = Date.now() - start;
        if (!reachable) detail = "Injoignable ou refusé";
      } catch {
        latencyMs = Date.now() - start;
        reachable = false;
        detail = "Injoignable ou refusé";
      }
    }

    return {
      key: spec.key,
      label: spec.label,
      area: spec.area,
      required: spec.required,
      configured,
      reachable,
      detail,
      latencyMs,
      ...quota,
    };
  }

  /**
   * `today`/`thisMonth`/`limit`/`percentUsed` for one spec, or `{}` for
   * `webPush` — it makes no outbound calls, so a call-based quota is
   * meaningless for it (see {@link QuotaTrackerService}).
   */
  private quotaFieldsFor(
    spec: ServiceSpec,
    now: Date,
    callRows: { provider: string; day: Date; count: number }[],
  ): Partial<ServiceStatusDto> {
    if (spec.key === "webPush") return {};

    const today = startOfUtcDay(now);
    const providerRows = callRows.filter((r) => r.provider === spec.key);
    const todayCount =
      providerRows.find((r) => r.day.getTime() === today.getTime())?.count ?? 0;
    const monthCount = providerRows.reduce((sum, r) => sum + r.count, 0);

    if (!spec.quotaLimit) {
      return { today: todayCount, thisMonth: monthCount };
    }

    const used = spec.quotaLimit.window === "day" ? todayCount : monthCount;
    return {
      today: todayCount,
      thisMonth: monthCount,
      limit: spec.quotaLimit,
      percentUsed: Math.round((used / spec.quotaLimit.max) * 100),
    };
  }

  private env(key: string): string {
    return this.config.get<string>(key) ?? "";
  }

  /** Runs a probe under an abort-timeout, so no single service stalls the page. */
  private async withTimeout(
    probe: (signal: AbortSignal) => Promise<boolean>,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      return await probe(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * A health ping: only a 2xx response counts as healthy, so a rejected key
   * (401/403) or bad credentials (400) surface as "down" rather than merely
   * "the host answered". OMDb is a known exception — it replies 200 even for an
   * invalid key — but presence of the key is already reported separately.
   */
  private async ping(url: string, init: RequestInit): Promise<boolean> {
    const response = await fetch(url, init);
    return response.ok;
  }
}
