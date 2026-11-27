<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getMyYear } from "#lib/api/stats.js";
  import { auth } from "#lib/auth/auth.svelte.js";
  import Icon from "#lib/ui/Icon.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { figureLines } from "#lib/home/figure-lines.js";
  import { formatNumber } from "#lib/ui/format.js";
  import { HOME_WIDGETS } from "#lib/home/widgets.js";
  import { m } from "#lib/paraglide/messages.js";
  import WidgetShell from "../WidgetShell.svelte";

  const def = HOME_WIDGETS.myYear;
  // The viewer's own calendar year, not the server's.
  const year = new Date().getFullYear();

  const yearQuery = createApiQuery(() => ({
    key: keys.home.myYear(year),
    fetch: () => getMyYear(year),
    enabled: !!auth.user,
  }));

  const lines = $derived(yearQuery.data ? figureLines(yearQuery.data) : []);
</script>

<WidgetShell icon={def.icon} title={def.title()} tag={String(year)}>
  {#if yearQuery.loading}
    <p class="text-dim text-sm">{m.common_loading()}</p>
  {:else if lines.length === 0}
    <p class="text-dim text-sm">{m.home_my_year_empty()}</p>
  {:else}
    <ul class="flex flex-col">
      {#each lines as line (line.domain)}
        <li
          class="border-surface-2 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 border-t py-2 first:border-t-0 first:pt-0">
          <Icon
            name={DOMAINS[line.domain].icon}
            class="text-dim h-4 w-4 self-center" />
          <div class="min-w-0">
            <p class="truncate text-sm">
              <span class="font-display text-xl font-extrabold tabular-nums">
                {formatNumber(line.value)}
              </span>
              {line.label}
            </p>
            {#if line.detail}
              <p class="text-dim truncate text-xs">{line.detail}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</WidgetShell>
