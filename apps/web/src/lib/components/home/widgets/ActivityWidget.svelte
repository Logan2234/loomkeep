<script lang="ts">
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";
  import { loadActivity } from "./activity";
  import { widgetDomains } from "./domains";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.activity;

  const domains = $derived(widgetDomains(widget));
  const previewQuery = createApiQuery(() => ({
    key: keys.feed.home(domains?.join(",") ?? "ALL"),
    fetch: () => loadActivity(domains),
  }));
  const events = $derived(previewQuery.data ?? []);

  // Events wrap onto a second line unpredictably, so the list scrolls rather
  // than counting how many fit.
  const columns = $derived(bodyOf(size).width >= 720 ? 2 : 1);
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  href="/app/feed"
  linkLabel={m.home_activity_view_feed()}>
  {#if previewQuery.loading}
    <div class="space-y-2">
      {#each { length: 3 } as _, i (i)}
        <div class="skeleton h-14 w-full rounded-xl"></div>
      {/each}
    </div>
  {:else if events.length > 0}
    <!-- Rows as tall as their event: each event is a card, which hides its
         overflow and so may shrink to nothing — auto rows would squeeze
         them all into the widget's height rather than let the list scroll. -->
    <ul
      class="no-scrollbar grid h-full auto-rows-max content-start gap-2 overflow-y-auto"
      style:grid-template-columns={`repeat(${columns}, minmax(0, 1fr))`}>
      {#each events as event (event.id)}
        <ActivityItem {event} />
      {/each}
    </ul>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_activity_empty()}
    </p>
  {/if}
</WidgetShell>
