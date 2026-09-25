<script lang="ts">
  import { getStatsBrief } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { formatDate, formatNumber, MONTH_YEAR_OPTIONS } from "$lib/format";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { m } from "$lib/paraglide/messages.js";
  import type { StatsBriefDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";

  const def = HOME_WIDGETS.statsBrief;

  // The start of the viewer's own month, so "this month" is theirs.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const briefQuery = createApiQuery(() => ({
    key: keys.home.brief(monthStart.toISOString()),
    fetch: () => getStatsBrief(monthStart),
    enabled: !!auth.user,
  }));

  const LABELS: Record<keyof StatsBriefDto, () => string> = {
    episodes: () => m.home_brief_episodes(),
    movies: () => m.home_brief_movies(),
    games: () => m.home_brief_games(),
    books: () => m.home_brief_books(),
    albums: () => m.home_brief_albums(),
  };
  // A domain turned off comes back null and takes no tile.
  const counters = $derived(
    Object.entries(briefQuery.data ?? {})
      .filter(
        (entry): entry is [keyof StatsBriefDto, number] => entry[1] !== null,
      )
      .map(([key, value]) => ({ key, value, label: LABELS[key]() })),
  );
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  tag={formatDate(monthStart.toISOString(), MONTH_YEAR_OPTIONS)}
  href="/app/stats"
  linkLabel={m.common_see_more()}>
  {#if briefQuery.loading}
    <div
      class="grid h-full grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2">
      {#each { length: 4 } as _, i (i)}
        <div class="skeleton rounded-lg"></div>
      {/each}
    </div>
  {:else}
    <ul
      class="grid h-full grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] content-center gap-2">
      {#each counters as counter (counter.key)}
        <li
          class="border-border flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center">
          <span class="timecode text-fg text-2xl leading-none font-bold">
            {formatNumber(counter.value)}
          </span>
          <span class="text-dim mt-1 text-[0.7rem] leading-tight">
            {counter.label}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</WidgetShell>
