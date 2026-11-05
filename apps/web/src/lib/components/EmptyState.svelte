<script lang="ts">
  import type { Snippet } from "svelte";
  import EmptyArt, { type EmptyArtName } from "./EmptyArt.svelte";

  // What a screen shows with nothing in it (SHL-08). With `art`, a line
  // drawing, a title and the children (one sentence, one action); `compact`
  // lays it out as a row for a widget or a section. Without `art`, a plain
  // centred sentence: a filter with no match, an admin table.
  let {
    class: cls = "",
    children,
    padding = "py-16",
    art,
    title,
    compact = false,
  }: {
    class?: string;
    children?: Snippet;
    padding?: "py-12" | "py-14" | "py-16";
    art?: EmptyArtName;
    title?: string;
    compact?: boolean;
  } = $props();
</script>

{#if compact}
  <div class="text-dim flex items-center gap-3 py-2 text-sm {cls}">
    {#if art}
      <EmptyArt name={art} class="h-9 w-12 shrink-0" />
    {/if}
    <div class="min-w-0 flex-1">
      {#if title}
        <p class="text-fg font-semibold">{title}</p>
      {/if}
      {@render children?.()}
    </div>
  </div>
{:else}
  <div
    class="text-dim flex flex-col items-center px-6 text-center {art
      ? 'py-10'
      : padding} {cls}">
    {#if art}
      <EmptyArt name={art} class="mb-3 h-24 w-32" />
    {/if}
    {#if title}
      <p
        class="font-display text-fg mb-1 max-w-[24ch] text-lg leading-snug font-bold text-balance">
        {title}
      </p>
    {/if}
    {@render children?.()}
  </div>
{/if}
