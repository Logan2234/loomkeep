<script lang="ts">
  import { getEditableLists } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.myLists;

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
  // The most recently changed first, like "Mes listes" by default.
  const lists = $derived(
    [...(listsQuery.data ?? [])].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  );

  const count = (n: number) =>
    `${n} ${n > 1 ? m.lists_works_plural() : m.lists_works_singular()}`;
</script>

<WidgetShell icon={def.icon} title={def.title()} href="/app/lists">
  {#if !listsQuery.loading && lists.length === 0}
    <div class="flex h-full flex-col items-center justify-center gap-2">
      <p class="text-dim text-center text-sm">{m.home_my_lists_empty()}</p>
      <a href="/app/lists" class="btn btn-ghost btn-sm">
        {m.home_my_lists_create()}
      </a>
    </div>
  {:else}
    <PosterRail
      items={lists}
      keyOf={(list) => list.id}
      info={(list) => ({
        href: `/app/lists/${list.id}`,
        title: list.title,
        imageUrl: list.previewImageUrls[0] ?? null,
        subtitle: count(list.itemCount),
      })}
      {size}
      metaHeight={16}
      loading={listsQuery.loading}
      empty={m.home_my_lists_empty()}>
      {#snippet image(list)}
        <ListCoverGrid images={list.previewImageUrls} title={list.title} />
      {/snippet}
      {#snippet meta(list)}
        <p class="timecode truncate text-[0.65rem]">{count(list.itemCount)}</p>
      {/snippet}
    </PosterRail>
  {/if}
</WidgetShell>
