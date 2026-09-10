import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Records one call against a provider's daily counter, for the /admin/services
 * page. Fire-and-forget: counting must never slow down or break the real
 * upstream call, so failures are swallowed rather than surfaced.
 *
 * Call this once per HTTP attempt actually made to the provider — pass it as
 * `fetchJson`'s `onAttempt` (see http.util.ts) so a 429/5xx retried up to
 * three times is counted three times, not one. Calling it once before
 * `fetchJson()` instead (the pattern still used by igdb/tmdb/anilist/
 * musicbrainz/open-library today) undercounts retries and is kept working
 * only for backward compatibility — see OBS-02.
 */
@Injectable()
export class QuotaTrackerService {
  constructor(private readonly prisma: PrismaService) {}

  record(provider: string): void {
    const day = startOfUtcDay(new Date());
    this.prisma.apiCallCounter
      .upsert({
        where: { provider_day: { provider, day } },
        update: { count: { increment: 1 } },
        create: { provider, day, count: 1 },
      })
      .catch(() => {});
  }
}
