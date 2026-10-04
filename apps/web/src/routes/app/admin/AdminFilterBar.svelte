<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import type { Snippet } from "svelte";
  let {
    children,
    count,
    loading = false,
    error = false,
    active = [],
    onReset,
  }: {
    children: Snippet;
    count: number;
    loading?: boolean;
    error?: boolean;
    active?: { label: string; remove: () => void }[];
    onReset: () => void;
  } = $props();
</script>

<section aria-label={m.common_filters()} class="card mb-5 space-y-3 p-4">
  <div class="flex flex-wrap items-center gap-2">{@render children()}</div>
  <div
    class="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3">
    <p class="text-dim text-xs" aria-live="polite">
      {loading
        ? m.common_loading()
        : error
          ? m.common_unavailable()
          : m.admin_list_loaded({ count })}
    </p>
    {#if active.length}
      <button class="btn btn-ghost btn-sm" onclick={onReset}>
        {m.admin_filters_reset()}
      </button>
    {/if}
  </div>
  {#if active.length}
    <div class="flex flex-wrap gap-2">
      {#each active as filter (filter)}
        <button
          class="border-border text-dim hover:text-fg rounded-full border px-2.5 py-1 text-xs"
          onclick={filter.remove}>
          {filter.label}
          <span aria-hidden="true">×</span>
          <span class="sr-only"> — {m.common_remove()}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>
