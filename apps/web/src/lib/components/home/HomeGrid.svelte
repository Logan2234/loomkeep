<script lang="ts">
  // The home page's widgets: placed on the 12-column grid on a wide screen,
  // stacked in reading order (top row first, then left to right) on a
  // narrow one, each keeping its height — except the quick links, which grow
  // to show every link: a block made wide and short for a desktop would
  // otherwise hide most of them on a phone.
  import { stackOrder } from "$lib/home/grid";
  import {
    columnsToPixels,
    HOME_GAP,
    HOME_GRID_MIN_WIDTH,
    HOME_ROW_HEIGHT,
    rowsToPixels,
  } from "$lib/home/widgets";
  import { prefersReducedMotion } from "$lib/motion";
  import { HOME_GRID_COLUMNS, type HomeWidgetDto } from "@loomkeep/shared";
  import { fly } from "svelte/transition";
  import HomeWidget from "./HomeWidget.svelte";

  let { widgets }: { widgets: HomeWidgetDto[] } = $props();

  let width = $state(0);
  const placed = $derived(width >= HOME_GRID_MIN_WIDTH);
  const ordered = $derived(stackOrder(widgets));
  // A vertical divider separates columns, which a stacked page no longer has.
  const stacked = $derived(ordered.filter((w) => w.type !== "dividerVertical"));
  const rank = $derived(new Map(ordered.map((w, i) => [w.id, i])));

  const reduced = prefersReducedMotion();
  // The page settles in reading order, a beat apart — short enough that the
  // last widget is in before anyone reaches for it.
  const settle = (id: string) => ({
    y: 10,
    duration: reduced ? 0 : 280,
    delay: reduced ? 0 : Math.min(rank.get(id) ?? 0, 8) * 45,
  });
</script>

<div bind:clientWidth={width}>
  {#if width > 0 && placed}
    <div
      class="grid"
      style:grid-template-columns={`repeat(${HOME_GRID_COLUMNS}, minmax(0, 1fr))`}
      style:grid-auto-rows={`${HOME_ROW_HEIGHT}px`}
      style:gap={`${HOME_GAP}px`}>
      {#each widgets as widget (widget.id)}
        <div
          class="min-w-0"
          style:grid-column={`${widget.x + 1} / span ${widget.w}`}
          style:grid-row={`${widget.y + 1} / span ${widget.h}`}
          in:fly|global={settle(widget.id)}>
          <HomeWidget
            {widget}
            size={{
              width: columnsToPixels(widget.w, width),
              height: rowsToPixels(widget.h),
            }} />
        </div>
      {/each}
    </div>
  {:else if width > 0}
    <div class="flex flex-col" style:gap={`${HOME_GAP}px`}>
      {#each stacked as widget (widget.id)}
        <div
          style:height={widget.type === "quickLinks"
            ? undefined
            : `${rowsToPixels(widget.h)}px`}
          style:min-height={`${rowsToPixels(widget.h)}px`}
          in:fly|global={settle(widget.id)}>
          <HomeWidget
            {widget}
            size={{ width, height: rowsToPixels(widget.h) }} />
        </div>
      {/each}
    </div>
  {/if}
</div>
