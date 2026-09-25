<script lang="ts">
  import { getOnThisDay } from "$lib/api/stats";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { formatDate } from "$lib/format";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { OnThisDayEntryDto } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.onThisDay;

  // The viewer's own calendar day, not the server's.
  const today = new Date();
  const localDay = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const yearAgo = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate(),
  );

  const memoriesQuery = createApiQuery(() => ({
    key: keys.home.onThisDay(localDay),
    fetch: () => getOnThisDay(localDay),
    enabled: !!auth.user,
  }));

  const DAY_MONTH: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  function caption(entry: OnThisDayEntryDto): string {
    const day = formatDate(entry.date, DAY_MONTH);
    if (entry.count > 1)
      return m.home_on_this_day_episodes({ count: entry.count, day });
    const kind = {
      watched: m.home_on_this_day_watched,
      started: m.home_on_this_day_started,
      finished: m.home_on_this_day_finished,
    }[entry.kind];
    return kind({ day });
  }
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  tag={formatDate(yearAgo, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}>
  <PosterRail
    items={memoriesQuery.data ?? []}
    keyOf={(e) => `${e.domain}:${e.title}:${e.date}`}
    label={def.title()}
    info={(e) => ({
      href: e.href,
      title: e.title,
      imageUrl: e.imageUrl,
      subtitle: caption(e),
    })}
    {size}
    metaHeight={16}
    loading={memoriesQuery.loading}
    empty={m.home_on_this_day_empty()}>
    {#snippet meta(e)}
      <p class="timecode truncate text-[0.65rem]">{caption(e)}</p>
    {/snippet}
  </PosterRail>
</WidgetShell>
