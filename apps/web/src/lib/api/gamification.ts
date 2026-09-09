import type {
  AchievementDto,
  LeaderboardDto,
  LeaderboardPeriod,
  LeaderboardScope,
  OnboardingChecklistDto,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export function getAchievements() {
  return typedRequest("/achievements") as Promise<AchievementDto[]>;
}

export function signalVersionLinkClicked() {
  typedRequest("/achievements/signals/version-link", { method: "POST" });
}

export function getPendingAchievements() {
  return typedRequest("/achievements/pending");
}

export function markAchievementDisplayed(id: string) {
  typedRequest(`/achievements/{id}/displayed`, {
    method: "PATCH",
    params: { id },
  });
}

export function equipAchievement(key: string) {
  return typedRequest("/achievements/{key}/equip", {
    method: "POST",
    params: { key },
  }) as Promise<string[]>;
}

export function unequipAchievement(key: string) {
  return typedRequest("/achievements/{key}/equip", {
    method: "DELETE",
    params: { key },
  }) as Promise<string[]>;
}

export function getMyProgression() {
  return typedRequest("/gamification/me");
}

export function getLeaderboard(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
) {
  return typedRequest("/leaderboard", {
    query: { scope, period },
  }) as Promise<LeaderboardDto>;
}

export function getOnboardingChecklist() {
  return typedRequest(
    "/gamification/onboarding",
  ) as Promise<OnboardingChecklistDto>;
}

export function skipOnboardingStep(key: string) {
  return typedRequest("/gamification/onboarding/{key}/skip", {
    method: "POST",
    params: { key },
  }) as Promise<OnboardingChecklistDto>;
}
