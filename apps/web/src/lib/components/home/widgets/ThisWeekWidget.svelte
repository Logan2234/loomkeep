<script lang="ts">
  import { getCalendar } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { formatDate } from "$lib/format";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, rowsLayout, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { CalendarEntryDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";
  import { epCode, mediaHref } from "./media";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.thisWeek;

  const calendarQuery = createApiQuery(() => ({
    key: keys.calendar.upcoming(),
    fetch: getCalendar,
    enabled: !!auth.user,
  }));

  const rows = $derived(rowsLayout(bodyOf(size)));
  const shown = $derived((calendarQuery.data ?? []).slice(0, rows.count));
  const filled = $derived(shown.length === rows.count);

  const WEEKDAY_SHORT: Intl.DateTimeFormatOptions = { weekday: "short" };
  const DAY_MONTH: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  // A tall widget reaches past this week, where a weekday alone would be
  // ambiguous.
  function dayShort(iso: string): string {
    const day = new Date(iso);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return m.common_today_short();
    if (diff === 1) return m.common_tomorrow();
    return formatDate(iso, diff < 7 ? WEEKDAY_SHORT : DAY_MONTH);
  }
  const keyOf = (e: CalendarEntryDto) => e.mediaItem.id + epCode(e);
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  href="/app/calendar"
  linkLabel={m.common_calendar()}>
  {#if calendarQuery.loading}
    <div class="space-y-2">
      {#each { length: Math.min(rows.count, 4) } as _, i (i)}
        <div class="flex h-12 items-center gap-3">
          <div class="skeleton h-12 w-8 shrink-0 rounded-md"></div>
          <div class="skeleton h-3 w-3/5 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if shown.length > 0}
    <!-- Like PosterRail's rows: filled, they share the leftover height. -->
    <ul
      class="grid gap-x-4 {filled ? 'h-full' : ''}"
      style:grid-template-columns={`repeat(${rows.columns}, minmax(0, 1fr))`}
      style:grid-template-rows={filled
        ? `repeat(${rows.count / rows.columns}, minmax(3.5rem, 1fr))`
        : undefined}>
      {#each shown as e (keyOf(e))}
        <li class="border-border border-b last:border-b-0">
          <a
            href={mediaHref(e.mediaItem)}
            class="flex h-full min-h-14 items-center gap-3">
            <div class="w-8 shrink-0 overflow-hidden rounded-md">
              <Poster src={e.mediaItem.posterUrl} title={e.mediaItem.title} />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-display truncate text-sm font-semibold">
                {e.mediaItem.title}
              </p>
              <p class="timecode text-xs">{epCode(e)}</p>
            </div>
            <span
              class="border-accent/40 text-accent timecode shrink-0 rounded-md border px-1.5 py-0.5 text-[0.65rem]">
              {dayShort(e.airDate)}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_nothing_this_week()}
    </p>
  {/if}
</WidgetShell>
