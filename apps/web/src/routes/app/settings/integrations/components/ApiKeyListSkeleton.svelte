<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";

  let { count = 3 }: { count?: number } = $props();
</script>

<!-- Same frame as the loaded list (one card, divided rows), so nothing jumps. -->
<div role="status" aria-busy="true">
  <span class="sr-only">{m.common_loading()}</span>
  <div aria-hidden="true" class="flex flex-col gap-3">
    <div class="flex justify-end gap-2">
      <div class="skeleton h-8 w-28 rounded-lg"></div>
      <div class="skeleton h-8 w-32 rounded-lg"></div>
    </div>
    <div class="card divide-border divide-y overflow-hidden">
      {#each { length: count } as _, i (i)}
        <div class="flex items-center gap-4 px-4 py-3">
          <div class="skeleton hidden h-5 w-5 shrink-0 rounded sm:block"></div>
          <div class="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <div class="skeleton h-4 w-24 rounded"></div>
            <div class="skeleton h-3.5 w-3/5 rounded"></div>
          </div>
          <div class="skeleton h-4 w-4 shrink-0 rounded"></div>
        </div>
      {/each}
    </div>
  </div>
</div>
