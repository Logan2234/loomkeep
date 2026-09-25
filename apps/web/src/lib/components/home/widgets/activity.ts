import { getFeed } from "$lib/api/client";
import type { ActivityEventDto, Domain } from "@loomkeep/shared";

/**
 * The first page of the feed, as /app/feed shows it — or of each picked
 * domain's feed, merged newest first. Never a shorter teaser: the feed caps a
 * page by raw events before hiding and grouping them, so a short one can lose
 * a whole domain behind a friend's burst of events.
 */
export async function loadActivity(
  domains: Domain[] | null,
): Promise<ActivityEventDto[]> {
  const pages = await Promise.all(
    (domains ?? [undefined]).map((d) => getFeed(1, d)),
  );
  return pages
    .flatMap((page) => page.items)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
