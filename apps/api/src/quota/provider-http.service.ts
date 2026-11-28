import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchJson, identifyingUserAgent } from "../common/http.util";
import { RequestThrottle } from "../common/request-throttle";
import { MetricsService } from "../metrics/metrics.service";
import { QuotaTrackerService } from "./quota-tracker.service";

type FetchOptions = Omit<
  NonNullable<Parameters<typeof fetchJson>[2]>,
  "sourceLabel" | "onAttempt" | "onResponse"
>;

/**
 * One catalogue provider's way out: its throttle, waited for before every
 * attempt (retries included), its quota counter, its metrics and, when it
 * asks for it, the User-Agent naming the instance's contact. Each provider
 * used to wire these itself, and the throttle had to be plugged back into
 * the retries of IGDB and AniList by hand.
 */
export class ProviderHttpClient {
  private readonly throttle: RequestThrottle | null;

  constructor(
    private readonly options: {
      /** Quota and metrics key ("tmdb", "openLibrary"…). */
      provider: string;
      sourceLabel: string;
      /** Shared by every caller on the instance: one request per interval. */
      minIntervalMs?: number;
      /** Sends the identifying User-Agent (Open Library, MusicBrainz). */
      userAgent?: string;
    },
    private readonly quota: QuotaTrackerService,
    private readonly metrics: MetricsService,
  ) {
    this.throttle = options.minIntervalMs
      ? new RequestThrottle(options.minIntervalMs)
      : null;
  }

  fetchJson<T>(
    url: string | URL,
    init: RequestInit,
    opts: FetchOptions = {},
  ): Promise<T> {
    return fetchJson<T>(
      url,
      this.options.userAgent
        ? {
            ...init,
            headers: {
              "User-Agent": this.options.userAgent,
              ...(init.headers as Record<string, string> | undefined),
            },
          }
        : init,
      {
        ...opts,
        sourceLabel: this.options.sourceLabel,
        beforeAttempt: async () => {
          await this.throttle?.wait();
          await opts.beforeAttempt?.();
        },
        onAttempt: () => this.quota.record(this.options.provider),
        onResponse: (status) => this.recordResponse(status),
      },
    );
  }

  /**
   * For a provider's own request loop, outside {@link fetchJson}: waits its
   * turn and counts the attempt. Pair with {@link recordResponse}.
   */
  async beforeAttempt(): Promise<void> {
    await this.throttle?.wait();
    this.quota.record(this.options.provider);
  }

  recordResponse(status: number | null): void {
    this.metrics.recordProviderResponse(this.options.provider, status);
  }
}

@Injectable()
export class ProviderHttpService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProviderHttpService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly quota: QuotaTrackerService,
    private readonly metrics: MetricsService,
  ) {}

  /** API_CONTACT, which Open Library and MusicBrainz ask callers to give. */
  get contact(): string | undefined {
    return this.config.get<string>("API_CONTACT") || undefined;
  }

  onApplicationBootstrap(): void {
    if (this.contact) return;
    // Every instance without it shares one anonymous User-Agent, which
    // Open Library slows to 1 request/s and MusicBrainz may block outright.
    this.logger.warn(
      "API_CONTACT is empty: Open Library and MusicBrainz get an anonymous User-Agent. Set it to an email or URL where you can be reached.",
    );
  }

  client(options: {
    provider: string;
    sourceLabel: string;
    minIntervalMs?: number;
    identify?: boolean;
  }): ProviderHttpClient {
    return new ProviderHttpClient(
      {
        provider: options.provider,
        sourceLabel: options.sourceLabel,
        minIntervalMs: options.minIntervalMs,
        userAgent: options.identify
          ? identifyingUserAgent(this.contact)
          : undefined,
      },
      this.quota,
      this.metrics,
    );
  }
}
