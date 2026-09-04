import type { AchievementDto } from "@loomkeep/shared";
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

export function getMyProgression() {
  return typedRequest("/gamification/me");
}
