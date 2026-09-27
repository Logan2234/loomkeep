import type { AchievementRarityDto } from "@loomkeep/shared";

// Below this many eligible members (a family instance), a share is one or
// two people's doing and says nothing about how hard an achievement is.
export const RARITY_MIN_ELIGIBLE_USERS = 20;

// Below this many holders, only an upper bound is shown: "2 members out of
// 40" would be close to naming them.
export const RARITY_MIN_EXACT_HOLDERS = 3;

// Who counts as a member for the share: onboarded, active in this window.
export const RARITY_ACTIVE_WINDOW_DAYS = 365;

export function toRarity(
  holders: number,
  eligibleUsers: number,
): AchievementRarityDto | null {
  if (eligibleUsers < RARITY_MIN_ELIGIBLE_USERS) return null;

  if (holders > 0 && holders < RARITY_MIN_EXACT_HOLDERS) {
    return {
      percent: Math.ceil((RARITY_MIN_EXACT_HOLDERS / eligibleUsers) * 100),
      upperBound: true,
    };
  }

  const percent = (holders / eligibleUsers) * 100;
  return {
    // A decimal only where it changes the reading: 0.4 % vs 4 %.
    percent: percent < 10 ? Math.round(percent * 10) / 10 : Math.round(percent),
    upperBound: false,
  };
}
