import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";

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
