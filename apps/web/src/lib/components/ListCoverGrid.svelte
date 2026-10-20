<script lang="ts">
  import Poster from "./Poster.svelte";

  let {
    images,
    title,
  }: {
    images: string[];
    title: string;
  } = $props();
</script>

{#if images.length <= 1}
  <Poster src={images[0] ?? null} {title} alt="" />
{:else}
  <!-- min-h-0: an aspect-ratio box otherwise grows to fit its images'
       natural height, spilling out of a small slot (a list row's cover). -->
  <div
    class="bg-surface-2 grid aspect-2/3 min-h-0 grid-cols-2 grid-rows-2 gap-0.5">
    {#each Array(4) as _, i (i)}
      {#if images[i]}
        <img
          src={images[i]}
          alt=""
          loading="lazy"
          class="h-full min-h-0 w-full object-cover" />
      {:else}
        <div class="bg-surface-2"></div>
      {/if}
    {/each}
  </div>
{/if}
