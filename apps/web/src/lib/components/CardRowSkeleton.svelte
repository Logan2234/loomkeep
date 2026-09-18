<script lang="ts">
  let { count = 4 }: { count?: number } = $props();
</script>

<div class="flex flex-col gap-2.5">
  {#each { length: count } as _, i (i)}
    <div class="card flex items-center gap-4 p-4">
      <div class="skeleton h-9 w-9 shrink-0 rounded-xl"></div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="skeleton h-3.5 w-2/5 rounded"></div>
        <div class="skeleton h-3 w-1/4 rounded"></div>
      </div>
    </div>
  {/each}
</div>
