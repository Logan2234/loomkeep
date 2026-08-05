<script lang="ts">
  // Loading placeholder for a row of StatTile — the shape every /stats
  // section shows while its own endpoint answers.
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
  {#each { length: 4 } as _, i (i)}
    <div class="card p-4">
      <div class="skeleton h-8 w-2/3 rounded"></div>
      <div class="skeleton mt-2 h-3 w-4/5 rounded"></div>
    </div>
  {/each}
</div>
