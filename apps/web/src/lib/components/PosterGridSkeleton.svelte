<script lang="ts">
  // Loading placeholder for poster listings (books/games/media): a grid of
  // shimmering poster cards.
  import { m } from "$lib/paraglide/messages.js";
  import PosterGrid from "./PosterGrid.svelte";

  let { count = 10 }: { count?: number } = $props();
</script>

<div role="status" aria-busy="true">
  <span class="sr-only">{m.common_loading()}</span>
  <div aria-hidden="true">
    <PosterGrid>
      {#each { length: count } as _, i (i)}
        <div class="card">
          <div class="skeleton aspect-2/3 w-full"></div>
          <div class="flex flex-col gap-2 p-3">
            <div class="skeleton h-3.5 w-4/5 rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
          </div>
        </div>
      {/each}
    </PosterGrid>
  </div>
</div>
