import { m } from "#lib/paraglide/messages.js";
import { AcquisitionSource } from "@loomkeep/shared/enums";

const SHUFFLED = Object.values(AcquisitionSource).filter(
  (source) => source !== AcquisitionSource.OTHER,
);

/**
 * The sources in a random order, so that none gains answers from its place
 * in the row, "Other" always last. `stored` is the order picked earlier in
 * the session (comma-separated, without "Other"): reused as long as it still
 * holds exactly today's sources.
 */
export function acquisitionSourceOrder(
  stored: string | null,
  random: () => number = Math.random,
): AcquisitionSource[] {
  const previous = stored?.split(",") ?? [];

  if (
    previous.length === SHUFFLED.length &&
    SHUFFLED.every((source) => previous.includes(source))
  ) {
    return [...(previous as AcquisitionSource[]), AcquisitionSource.OTHER];
  }

  const order = [...SHUFFLED];

  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return [...order, AcquisitionSource.OTHER];
}

export const ACQUISITION_SOURCE_LABELS: Record<
  AcquisitionSource,
  () => string
> = {
  FRIEND: () => m.onboarding_acquisition_friend(),
  REDDIT: () => m.onboarding_acquisition_reddit(),
  SEARCH_ENGINE: () => m.onboarding_acquisition_search_engine(),
  YOUTUBE: () => m.onboarding_acquisition_youtube(),
  TIKTOK_INSTAGRAM: () => m.onboarding_acquisition_tiktok_instagram(),
  X_BLUESKY_MASTODON: () => m.onboarding_acquisition_x_bluesky_mastodon(),
  DISCORD: () => m.onboarding_acquisition_discord(),
  ALTERNATIVETO_PRODUCTHUNT: () =>
    m.onboarding_acquisition_alternativeto_producthunt(),
  SELFHOSTED_COMMUNITY: () => m.onboarding_acquisition_selfhosted_community(),
  ARTICLE_BLOG: () => m.onboarding_acquisition_article_blog(),
  OTHER: () => m.common_other(),
};
