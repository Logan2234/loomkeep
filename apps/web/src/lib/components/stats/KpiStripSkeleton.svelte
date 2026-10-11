<script lang="ts">
  let {
    count,
    cardClass = "card h-20 space-y-3 p-4",
    valueClass = "skeleton h-6 w-2/5 rounded",
    labelClass = "skeleton h-3 w-3/4 rounded",
  }: {
    count: number;
    cardClass?: string;
    valueClass?: string;
    labelClass?: string;
  } = $props();
</script>

<div class="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
  {#each { length: count } as _, i (i)}<div class={cardClass}>
      <div class={valueClass}></div>
      <div class={labelClass}></div>
    </div>{/each}
</div>
