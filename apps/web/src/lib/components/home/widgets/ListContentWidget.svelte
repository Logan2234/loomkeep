<script lang="ts">
  import { getMyList } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.listContent;
  const listId = $derived(widget.config?.listId);

  // Same cache entry as the list's own page, so an edit there shows here.
  const listQuery = createApiQuery(() => ({
    key: keys.lists.detail(listId ?? ""),
    fetch: () => getMyList(listId!),
    enabled: !!listId,
  }));
  const list = $derived(listQuery.data);
</script>

<WidgetShell
  icon={def.icon}
  title={list?.title ?? def.title()}
  href={list ? `/app/lists/${list.id}` : undefined}
  linkLabel={m.home_list_content_see_list()}>
  {#if !listId}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_list_content_unset()}
    </p>
  {:else if listQuery.error}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_list_content_missing()}
    </p>
  {:else}
    <PosterRail
      label={list?.title ?? def.title()}
      items={list?.items ?? []}
      keyOf={(item) => item.id}
      info={(item) => ({
        href: item.target?.href ?? null,
        title: item.target?.title ?? "—",
        imageUrl: item.target?.imageUrl ?? null,
      })}
      {size}
      loading={listQuery.loading}
      empty={m.home_list_content_empty()} />
  {/if}
</WidgetShell>
