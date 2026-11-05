<script lang="ts">
  // Loading placeholder for poster listings (books/games/media): a grid of
  // shimmering posters, each with its title and meta lines.
  import type { LibraryPosterSize } from "#lib/library-view.js";
  import { m } from "#lib/paraglide/messages.js";
  import PosterGrid from "./PosterGrid.svelte";

  let { count = 10, size }: { count?: number; size?: LibraryPosterSize } =
    $props();
</script>

<div role="status" aria-busy="true">
  <span class="sr-only">{m.common_loading()}</span>
  <div aria-hidden="true">
    <PosterGrid {size}>
      {#each { length: count } as _, i (i)}
        <div>
          <div class="skeleton aspect-2/3 w-full rounded-lg"></div>
          <div class="mt-2 flex flex-col gap-1.5">
            <div class="skeleton h-3 w-4/5 rounded"></div>
            <div class="skeleton h-2.5 w-1/2 rounded"></div>
          </div>
        </div>
      {/each}
    </PosterGrid>
  </div>
</div>
