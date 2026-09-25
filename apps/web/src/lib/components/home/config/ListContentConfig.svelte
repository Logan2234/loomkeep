<script lang="ts">
  import { getEditableLists } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListCoverGrid from "$lib/components/ListCoverGrid.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let { listId = $bindable() }: { listId: string | undefined } = $props();

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
  const lists = $derived(
    [...(listsQuery.data ?? [])].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  );
</script>

<fieldset>
  <legend class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
    {m.home_list_content_config_pick()}
  </legend>
  {#if listsQuery.loading}
    <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {#each { length: 4 } as _, i (i)}
        <div class="skeleton aspect-2/3 w-full rounded-lg"></div>
      {/each}
    </div>
  {:else if lists.length === 0}
    <p class="text-dim text-sm">{m.home_list_content_config_none()}</p>
  {:else}
    <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {#each lists as list (list.id)}
        {@const chosen = list.id === listId}
        <label class="group relative cursor-pointer">
          <input
            type="radio"
            name="list"
            value={list.id}
            class="peer sr-only"
            checked={chosen}
            onchange={() => (listId = list.id)} />
          <span
            class="card peer-focus-visible:ring-accent block overflow-hidden transition-[border-color,transform] duration-200 peer-focus-visible:ring-2 {chosen
              ? 'border-accent scale-[1.03]'
              : 'group-hover:border-accent/60'}">
            <ListCoverGrid images={list.previewImageUrls} title={list.title} />
          </span>
          {#if chosen}
            <span
              class="bg-accent text-accent-fg absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full shadow">
              <Icon name="check" class="h-3.5 w-3.5" />
            </span>
          {/if}
          <span class="mt-1.5 block truncate text-xs font-semibold">
            {list.title}
          </span>
        </label>
      {/each}
    </div>
  {/if}
</fieldset>
