import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Documented free-tier daily quotas, for the providers that publish one.
 * TMDB, AniList, IGDB and MusicBrainz limit requests per second instead, so a
 * daily count says nothing about how close they are to refusing.
 */
export const PROVIDER_DAILY_QUOTAS = {
  // https://www.omdbapi.com/apikey.aspx — free tier: 1,000 requests/day.
  omdb: 1000,
  // https://steamcommunity.com/dev/apiterms §2 — 100,000 calls/day.
  steam: 100_000,
  // Limited to 1,000 requests/day.
  simkl: 1000,
  // https://www.brevo.com free plan: 300 emails/day (see README "Email").
  smtp: 300,
} as const;

/** Shares of a daily quota that raise an alert, each at most once a day. */
const QUOTA_ALERT_THRESHOLDS = [0.8, 1] as const;

export interface QuotaThresholdReached {
  provider: string;
  count: number;
  limit: number;
  /** Which alert threshold was just reached: 0.8 or 1. */
  threshold: number;
}

/**
 * Records one call against a provider's daily counter, for the /admin/services
 * page. Fire-and-forget: counting must never slow down or break the real
 * upstream call, so failures are swallowed rather than surfaced.
 *
 * Call this once per HTTP attempt actually made to the provider — pass it as
 * `fetchJson`'s `onAttempt` (see http.util.ts), or call it inside a
 * provider's own retry loop — so a 429/5xx retried up to three times counts
 * three times, not one.
 */
@Injectable()
export class QuotaTrackerService {
  private readonly listeners: ((event: QuotaThresholdReached) => void)[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Subscribes to a provider reaching an alert threshold of its daily quota.
   * A subscription rather than an injected alert service: the alert goes out
   * by email, and MailService itself counts its sends through this tracker.
   */
  onThresholdReached(listener: (event: QuotaThresholdReached) => void): void {
    this.listeners.push(listener);
  }

  record(provider: string): void {
    const day = startOfUtcDay(new Date());
    this.prisma.apiCallCounter
      .upsert({
        where: { provider_day: { provider, day } },
        update: { count: { increment: 1 } },
        create: { provider, day, count: 1 },
        select: { count: true },
      })
      .then(({ count }) => this.checkThresholds(provider, count))
      .catch(() => {});
  }

  // Each counter value comes back from exactly one atomic increment, so
  // comparing for equality raises each threshold once per provider per day,
  // even under concurrent calls — and tomorrow's counter starts over.
  private checkThresholds(provider: string, count: number): void {
    const limit = (PROVIDER_DAILY_QUOTAS as Record<string, number>)[provider];
    if (limit === undefined) return;

    for (const threshold of QUOTA_ALERT_THRESHOLDS) {
      if (count !== Math.ceil(limit * threshold)) continue;

      for (const listener of this.listeners) {
        listener({ provider, count, limit, threshold });
      }
    }
  }
}
