<script lang="ts">
  import Carousel from "$lib/components/Carousel.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MyListDto } from "@loomkeep/shared";

  type ListTile =
    | { kind: "create"; key: "create" }
    | { kind: "list"; key: string; list: MyListDto };

  let {
    listTiles,
    selfManage,
    hasOwnLists,
    onCreateList,
  }: {
    listTiles: ListTile[];
    selfManage: boolean | undefined;
    hasOwnLists: boolean;
    onCreateList: () => void;
  } = $props();
</script>

<section class="mt-10">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="font-display text-xl font-bold">
      {m.common_lists()}
    </h2>
    {#if selfManage && hasOwnLists}
      <a
        href="/app/lists"
        class="text-dim hover:text-accent flex items-center gap-1 text-sm font-semibold md:hidden">
        {m.common_manage()}
        <Icon name="chevron-right" class="h-4 w-4" />
      </a>
    {/if}
  </div>
  <div class="flex items-stretch gap-4">
    {#if selfManage && hasOwnLists}
      <a href="/app/lists" class="mt-2 hidden w-28 shrink-0 sm:w-32 md:block">
        <div
          class="card hover:border-accent text-dim hover:text-accent flex aspect-2/3 flex-col items-center justify-center gap-1.5 transition-colors">
          <Icon name="list" class="h-6 w-6" />
          <span class="text-xs font-semibold">{m.common_view_all()}</span>
        </div>
      </a>
    {/if}
    <div class="min-w-0 flex-1">
      <Carousel items={listTiles} keyOf={(item) => item.key}>
        {#snippet card(item)}
          {#if item.kind === "create"}
            <button
              type="button"
              onclick={onCreateList}
              class="w-28 self-start sm:w-32">
              <div
                class="card text-dim hover:border-accent hover:text-accent flex aspect-2/3 flex-col items-center justify-center gap-1.5 border-dashed transition-colors">
                <Icon name="plus" class="h-6 w-6" />
                <span class="text-xs font-semibold">{m.common_create()}</span>
              </div>
            </button>
          {:else}
            <a href="/app/lists/{item.list.id}" class="block w-28 sm:w-32">
              <div
                class="card hover:border-accent overflow-hidden transition-colors">
                <ListCoverGrid
                  images={item.list.previewImageUrls}
                  title={item.list.title} />
              </div>
              <p class="mt-1.5 truncate text-xs font-semibold">
                {item.list.title}
              </p>
              {#if item.list.role === "EDITOR"}
                <p class="text-dim truncate text-[0.65rem]">
                  {m.list_owned_by_editor({
                    name: item.list.author.displayName,
                  })}
                </p>
              {/if}
            </a>
          {/if}
        {/snippet}
      </Carousel>
    </div>
  </div>
</section>
