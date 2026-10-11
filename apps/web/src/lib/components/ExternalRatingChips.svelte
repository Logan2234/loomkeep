<script lang="ts">
  import type { RatingDto } from "@loomkeep/shared";
  import { RATING_SOURCE_STYLES } from "#lib/provider-brands.js";
  import ProviderMark from "./ProviderMark.svelte";
  let {
    ratings,
    overlay = false,
    providerMarks = false,
  }: {
    ratings: RatingDto[];
    overlay?: boolean;
    providerMarks?: boolean;
  } = $props();
</script>

{#each ratings as rating (rating.source)}
  <svelte:element
    this={rating.url ? "a" : "span"}
    href={rating.url}
    target={rating.url ? "_blank" : undefined}
    rel={rating.url ? "noopener noreferrer" : undefined}
    class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold {RATING_SOURCE_STYLES[
      rating.source
    ] ??
      (overlay ? 'bg-white/15 text-white' : 'bg-surface-2 text-fg')} {rating.url
      ? 'transition-opacity hover:opacity-80'
      : ''}">
    {#if providerMarks && rating.source === "Open Library"}<ProviderMark
        brand="openlibrary"
        decorative
        class="h-3.5 w-3.5 shrink-0" />{/if}
    <span>{rating.source}</span><span class="tabular-nums opacity-90"
      >{rating.score}</span>
  </svelte:element>
{/each}
