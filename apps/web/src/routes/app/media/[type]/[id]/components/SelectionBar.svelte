<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { EpisodeWatchBatchAction } from "@loomkeep/shared";

  let {
    count,
    span,
    actions,
    busy,
    onAction,
    onExit,
  }: {
    count: number;
    /** "S03E08 → S03E16", "sur 2 saisons". */
    span: string;
    actions: { watch: string[]; rewatch: string[]; unwatch: string[] };
    busy: boolean;
    onAction: (action: EpisodeWatchBatchAction, ids: string[]) => void;
    onExit: () => void;
  } = $props();

  const PRIMARY = "bg-accent text-black hover:brightness-95";
  const SECONDARY = "border border-current/40 hover:bg-bg/10";
</script>

<div class="bg-fg text-bg flex flex-col gap-2 rounded-2xl p-3 shadow-xl">
  <div class="flex items-start gap-2">
    <p class="min-w-0 flex-1" aria-live="polite">
      <span class="block text-sm font-bold">
        {count === 1
          ? m.media_selection_count_one()
          : m.media_selection_count({ count })}
      </span>
      {#if span}
        <span class="timecode text-bg/80 block truncate text-[0.7rem]"
          >{span}</span>
      {/if}
    </p>
    <button
      type="button"
      class="hover:bg-bg/10 relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-150 after:absolute after:-inset-2"
      aria-label={m.media_selection_exit()}
      title={m.media_selection_exit()}
      onclick={onExit}>
      <Icon name="x" class="h-4 w-4" />
    </button>
  </div>
  {#if count > 0}
    <div class="flex flex-wrap gap-2">
      {#if actions.watch.length > 0}
        <button
          type="button"
          class="btn min-h-11 flex-1 whitespace-nowrap {PRIMARY}"
          disabled={busy}
          onclick={() => onAction("watch", actions.watch)}>
          {m.media_bulk_watch({ count: actions.watch.length })}
        </button>
      {/if}
      {#if actions.rewatch.length > 0}
        <button
          type="button"
          class="btn min-h-11 flex-1 whitespace-nowrap {actions.watch.length ===
          0
            ? PRIMARY
            : SECONDARY}"
          disabled={busy}
          onclick={() => onAction("rewatch", actions.rewatch)}>
          {m.media_bulk_rewatch({ count: actions.rewatch.length })}
        </button>
        <button
          type="button"
          class="btn min-h-11 flex-1 whitespace-nowrap {SECONDARY}"
          disabled={busy}
          onclick={() => onAction("unwatch", actions.unwatch)}>
          {m.media_bulk_unwatch({ count: actions.unwatch.length })}
        </button>
      {/if}
    </div>
  {/if}
</div>
