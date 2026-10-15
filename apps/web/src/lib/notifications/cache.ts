import type { NotificationDto, PagedResult } from "@loomkeep/shared";
import type { InfiniteData } from "@tanstack/svelte-query";

type Page = PagedResult<NotificationDto>;

/** What a notifications query caches: the bell's one page, or the history's pages. */
export type EntriesData = Page | InfiniteData<Page, number>;

/**
 * Rewrites every entry of a cached query (null drops it), so a change shows
 * at once on the bell and the page, before the server confirms it.
 */
export function mapEntries(
  data: EntriesData | undefined,
  fn: (entry: NotificationDto) => NotificationDto | null,
): EntriesData | undefined {
  if (!data) return data;
  const mapPage = (page: Page): Page => ({
    ...page,
    items: page.items.flatMap((entry) => fn(entry) ?? []),
  });
  return "pages" in data
    ? { ...data, pages: data.pages.map(mapPage) }
    : mapPage(data);
}

/** The entries a cached query holds, in order. */
export function entriesOf(data: EntriesData | undefined): NotificationDto[] {
  if (!data) return [];
  return "pages" in data
    ? data.pages.flatMap((page) => page.items)
    : data.items;
}

export type DaySection = "today" | "yesterday" | "week" | "older";

/** Which section of the page an entry falls in, by the viewer's local day. */
export function daySection(iso: string, now = new Date()): DaySection {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.ceil(
    (startOfToday.getTime() - new Date(iso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 7) return "week";
  return "older";
}

/** Consecutive entries grouped by section, newest first as they came. */
export function groupByDay(
  entries: NotificationDto[],
  now = new Date(),
): { section: DaySection; entries: NotificationDto[] }[] {
  const groups: { section: DaySection; entries: NotificationDto[] }[] = [];

  for (const entry of entries) {
    const section = daySection(entry.createdAt, now);
    const last = groups.at(-1);
    if (last?.section === section) last.entries.push(entry);
    else groups.push({ section, entries: [entry] });
  }

  return groups;
}
