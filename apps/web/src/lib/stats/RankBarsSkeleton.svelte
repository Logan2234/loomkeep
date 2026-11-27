<script lang="ts">
  let {
    count = 4,
    cardClass = "card mb-5 space-y-4 p-4",
    titleClass = "skeleton h-3 w-1/3 rounded",
    labelClass = "skeleton h-4 w-1/4 rounded",
    valueClass = "skeleton h-4 w-6 rounded",
    withValue = true,
  }: {
    count?: number;
    cardClass?: string;
    titleClass?: string;
    labelClass?: string;
    valueClass?: string;
    withValue?: boolean;
  } = $props();
</script>

<div class={cardClass}>
  <div class={titleClass}></div>
  {#each { length: count } as _, i (i)}
    <div class="space-y-2">
      {#if withValue}
        <div class="flex justify-between gap-4">
          <div class={labelClass}></div>
          <div class={valueClass}></div>
        </div>
      {:else}
        <div class={labelClass}></div>
      {/if}
      <div class="skeleton h-2 w-full rounded"></div>
    </div>
  {/each}
</div>
