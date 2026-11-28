import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { BookSagaService } from "../books/book-saga.service";
import type { EventsGateway } from "../events/events.gateway";
import type { GameSagaService } from "../games/game-saga.service";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { SessionXpService } from "../gamification/session-xp.service";
import type { XpService } from "../gamification/xp.service";
import { MetricsService } from "../metrics/metrics.service";
import { ProviderHttpService } from "../quota/provider-http.service";
import type { QuotaTrackerService } from "../quota/quota-tracker.service";

export function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

export function stubAchievements(): AchievementService {
  return { evaluate: vi.fn() } as unknown as AchievementService;
}

export function stubEvents(online = true): EventsGateway {
  return {
    emitToUser: vi.fn(),
    emitToList: vi.fn(),
    evictFromList: vi.fn(),
    isOnline: vi.fn().mockResolvedValue(online),
  } as unknown as EventsGateway;
}

export function makeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

export function stubSessionXp(): SessionXpService {
  return {
    awardForToday: vi.fn(),
    refreshAfterDelete: vi.fn(),
  } as unknown as SessionXpService;
}

/** A game or book saga lookup where no saga is ever complete. */
export function stubSagas<T extends GameSagaService | BookSagaService>(): T {
  return { completed: vi.fn().mockResolvedValue(null) } as unknown as T;
}

/** A config with every catalogue key set, so the instance offers every domain. */
export function allDomainsConfig(): ConfigService {
  return makeConfig({
    TMDB_API_TOKEN: "token",
    TWITCH_CLIENT_ID: "id",
    TWITCH_CLIENT_SECRET: "secret",
  });
}

/**
 * A real ProviderHttpService over a quota double, for provider specs.
 * `throttle: false` drops the provider's interval, for a spec making many
 * calls against a slow-paced provider (Open Library's 1 request/s).
 */
export function providerHttp(
  quota: { record: (provider: string) => void } = { record: () => undefined },
  config: { get: (key: string) => unknown } = { get: () => undefined },
  { throttle = true }: { throttle?: boolean } = {},
): ProviderHttpService {
  const service = new ProviderHttpService(
    config as unknown as ConfigService,
    quota as unknown as QuotaTrackerService,
    new MetricsService(),
  );
  if (throttle) return service;
  const client = service.client.bind(service);
  service.client = (options) =>
    client({ ...options, minIntervalMs: undefined });
  return service;
}
