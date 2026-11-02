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

  const BUTTON = "btn btn-sm min-h-10 whitespace-nowrap";
  const SECONDARY = "border-border hover:bg-surface-2 border";
</script>

<div
  class="border-border bg-surface flex flex-col gap-2 rounded-2xl border p-3 shadow-xl">
  <div class="flex items-center gap-2">
    <p
      class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2"
      aria-live="polite">
      <span class="text-sm font-bold">
        {count === 1
          ? m.media_selection_count_one()
          : m.media_selection_count({ count })}
      </span>
      {#if span}
        <span class="timecode text-dim truncate text-[0.7rem]">{span}</span>
      {/if}
    </p>
    <button
      type="button"
      class="btn-icon"
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
          class="{BUTTON} btn-primary"
          disabled={busy}
          onclick={() => onAction("watch", actions.watch)}>
          <Icon name="check" class="h-4 w-4" />
          {m.media_bulk_watch({ count: actions.watch.length })}
        </button>
      {/if}
      {#if actions.rewatch.length > 0}
        <button
          type="button"
          class="{BUTTON} {actions.watch.length === 0
            ? 'btn-primary'
            : SECONDARY}"
          disabled={busy}
          onclick={() => onAction("rewatch", actions.rewatch)}>
          <Icon name="refresh" class="h-4 w-4" />
          {m.media_bulk_rewatch({ count: actions.rewatch.length })}
        </button>
        <button
          type="button"
          class="{BUTTON} {SECONDARY}"
          disabled={busy}
          onclick={() => onAction("unwatch", actions.unwatch)}>
          {m.media_bulk_unwatch({ count: actions.unwatch.length })}
        </button>
      {/if}
    </div>
  {/if}
</div>
