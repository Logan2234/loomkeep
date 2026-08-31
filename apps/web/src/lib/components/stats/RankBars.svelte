<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // Horizontal ranked bars (genres, authors, artists, platforms…) — the
  // pattern already used ad hoc on /stats, extracted so every domain section
  // shares it. Shows the top `initialCount` items with a "tout voir" toggle
  // when there are more; the caller passes the full ranked list.
  import { formatNumber } from "$lib/format";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let {
    items,
    initialCount = 5,
  }: {
    items: {
      label: string;
      /** Drives the bar width; also what's printed unless `display` overrides it. */
      value: number;
      /** Any CSS colour (e.g. a domain token); overrides the accent fill. */
      color?: string;
      /** Printed instead of `value` when the raw number isn't readable ("64 Mo"). */
      display?: string;
      /** Small qualifier pinned after the label (a quota share, "sans limite"…). */
      badge?: { text: string; tone?: "neutral" | "warn" };
    }[];
    initialCount?: number;
  } = $props();

  let expanded = $state(false);

  const visible = $derived(expanded ? items : items.slice(0, initialCount));
  const max = $derived(Math.max(1, ...items.map((i) => i.value)));
  const hasMore = $derived(items.length > initialCount);
</script>

{#if items.length === 0}
  <p class="text-dim text-sm">{m.common_nothing_yet()}</p>
{:else}
  <ul class="flex flex-col gap-3">
    {#each visible as item (item.label)}
      <li>
        <div class="mb-1 flex items-center justify-between gap-2 text-sm">
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="truncate">{item.label}</span>
            {#if item.badge}
              <span
                class="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] {item
                  .badge.tone === 'warn'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-surface-2 text-dim'}">
                {item.badge.text}
              </span>
            {/if}
          </span>
          <span class="timecode shrink-0"
            >{item.display ?? formatNumber(item.value)}</span>
        </div>
        <ProgressBar
          value={(item.value / max) * 100}
          height="h-2"
          fillClass=""
          fillStyle="background:{item.color ?? 'var(--accent)'}" />
      </li>
    {/each}
  </ul>
  {#if hasMore}
    <button
      type="button"
      class="btn btn-ghost btn-sm mt-3.5 w-full"
      onclick={() => (expanded = !expanded)}>
      {expanded
        ? m.common_see_less()
        : m.common_view_all_count({ count: items.length })}
    </button>
  {/if}
{/if}
