<script lang="ts">
  // What a long press on a library entry opens on a phone: the shortcuts a
  // pointer finds on hover (favorite) or in the table (status, rating), and
  // the way into selection mode.
  import type { LibraryItemView } from "#lib/library-view.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { SelectOption } from "#lib/types/select-option.js";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";
  import Poster from "./Poster.svelte";

  let {
    item,
    statusOptions = [],
    onFavorite,
    onStatus,
    onReview,
    onSelect,
    onclose,
  }: {
    item: LibraryItemView;
    /** Empty where the status can't change from here. */
    statusOptions?: SelectOption[];
    onFavorite: (next: boolean) => void;
    onStatus: (status: string) => void;
    onReview: () => void;
    /** Enters selection mode with this entry; undefined where there's none. */
    onSelect?: () => void;
    onclose: () => void;
  } = $props();

  let drawer = $state<Drawer | null>(null);
  const titleId = "library-entry-sheet-title";

  function then(action: () => void) {
    return () => {
      action();
      drawer?.close();
    };
  }
</script>

<Drawer bind:this={drawer} {onclose} labelledby={titleId}>
  <div class="border-border flex items-center gap-3 border-b px-5 pb-3">
    <div class="w-10 shrink-0 overflow-hidden rounded-md">
      <Poster src={item.imageUrl} title={item.title} alt="" caption={false} />
    </div>
    <div class="min-w-0">
      <h2 id={titleId} class="truncate font-semibold">{item.title}</h2>
      <p class="timecode truncate text-xs">
        {item.progress?.label ?? item.status.label}
      </p>
    </div>
  </div>

  <div
    data-drawer-scroll
    class="min-h-0 flex-1 touch-pan-y overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
    <button
      type="button"
      class="active:bg-surface-2 flex min-h-13 w-full items-center gap-3.5 px-5 text-left font-medium"
      onclick={then(() => onFavorite(!item.favorite))}>
      <Icon
        name="star"
        class="text-accent h-5 w-5 {item.favorite ? 'fill-accent' : ''}" />
      {item.favorite ? m.common_favorite_remove() : m.common_favorite_add()}
    </button>

    {#if statusOptions.length > 0}
      <div class="px-5 pt-2 pb-3">
        <p
          class="text-dim text-micro mb-2.5 font-mono font-bold tracking-[0.14em] uppercase">
          {m.common_status()}
        </p>
        <div
          class="flex flex-wrap gap-2"
          role="group"
          aria-label={m.common_status()}>
          {#each statusOptions as option (option.value)}
            {@const on = option.value === item.status.value}
            <button
              type="button"
              class="chip"
              class:chip-on={on}
              aria-pressed={on}
              onclick={then(() => {
                if (!on) onStatus(option.value);
              })}>
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if !item.upcoming}
      <button
        type="button"
        class="active:bg-surface-2 flex min-h-13 w-full items-center gap-3.5 px-5 text-left font-medium"
        onclick={then(onReview)}>
        <Icon name="edit" class="text-dim h-5 w-5" />
        {m.library_entry_review()}
      </button>
    {/if}
    {#if onSelect}
      <button
        type="button"
        class="active:bg-surface-2 flex min-h-13 w-full items-center gap-3.5 px-5 text-left font-medium"
        onclick={then(onSelect)}>
        <Icon name="check" class="text-dim h-5 w-5" />
        {m.common_select()}
      </button>
    {/if}
  </div>
</Drawer>
