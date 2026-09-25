<script lang="ts">
  import { getFeed, getFeedPreview } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import ActivityItem from "$lib/components/ActivityItem.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";
  import { widgetDomains } from "./domains";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.activity;

  // Every domain: the feed's own home preview. Some of them: the first page
  // of each domain's feed, merged newest first.
  const domains = $derived(widgetDomains(widget));
  const previewQuery = createApiQuery(() => ({
    key: domains ? keys.feed.list(domains.join(",")) : keys.feed.preview(),
    fetch: () =>
      domains
        ? Promise.all(domains.map((d) => getFeed(1, d))).then((pages) =>
            pages
              .flatMap((page) => page.items)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          )
        : getFeedPreview(),
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
    <ul
      class="no-scrollbar grid h-full content-start gap-2 overflow-y-auto"
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
