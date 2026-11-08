<script lang="ts">
  import { pendingPoster } from "#lib/shared-poster.svelte.js";
</script>

{#snippet pendingImage()}
  {#if pendingPoster.src}
    <img
      src={pendingPoster.src}
      alt=""
      class="h-full w-full rounded-[inherit] object-cover" />
  {/if}
{/snippet}

<div
  class="relative flex min-h-[max(min(26.25rem,62svh),min(64vh,38.75rem))] flex-col justify-end">
  <div class="skeleton absolute inset-0"></div>
  <div
    class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent">
  </div>
  <div class="skeleton absolute top-4 left-4 h-8 w-24 rounded-full"></div>
  <div
    data-detail-poster
    class="skeleton absolute right-4 bottom-4 z-10 aspect-2/3 w-16 rounded-lg sm:w-20 md:right-6 md:bottom-6 md:w-24">
    {@render pendingImage()}
  </div>
  <div class="relative w-full pt-[4rem]">
    <div
      class="mx-auto max-w-5xl px-5 pr-20 pb-6 sm:pr-24 md:px-8 md:pr-8 md:pb-8">
      <div class="flex gap-2">
        <div class="skeleton h-6 w-16 rounded-full"></div>
        <div class="skeleton h-6 w-20 rounded-full"></div>
      </div>
      <div class="skeleton mt-2 h-9 w-2/3 max-w-xl rounded md:h-10"></div>
      <div class="skeleton mt-2 h-4 w-1/2 max-w-sm rounded"></div>
    </div>
  </div>
</div>

<div class="border-border border-b">
  <div
    class="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 md:px-8">
    <div class="skeleton h-10 w-32 rounded-full"></div>
    <div class="flex gap-2.5">
      <div class="skeleton h-9 w-9 rounded-full"></div>
      <div class="skeleton h-9 w-9 rounded"></div>
      <div class="skeleton h-9 w-9 rounded"></div>
    </div>
  </div>
</div>

<div class="mx-auto max-w-5xl px-5 pt-6 pb-6 md:px-8 md:pb-10">
  <div class="flex max-w-2xl flex-col gap-2">
    <div class="skeleton h-4 w-full rounded"></div>
    <div class="skeleton h-4 w-11/12 rounded"></div>
    <div class="skeleton h-4 w-2/3 rounded"></div>
  </div>
</div>
