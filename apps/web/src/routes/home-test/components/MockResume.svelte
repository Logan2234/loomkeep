<script lang="ts">
  // Mirrors the "Vidéo · à voir" card of /app: the section header with its
  // domain icon, then the row of posters each carrying its next episode and a
  // "Reprendre" button.
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { COVER, RESUME } from "./mock-data";
</script>

<section class="card">
  <div class="flex items-center justify-between p-4 pb-0">
    <h3 class="font-display flex items-center gap-2 text-base font-bold">
      <Icon name="tv" class="text-accent h-4 w-4" /> Vidéo · à voir
    </h3>
    <span class="btn-text">Voir plus →</span>
  </div>
  <div class="p-4">
    <div class="no-scrollbar flex gap-4 overflow-x-auto">
      {#each RESUME as item (item.title)}
        <div class="w-28 shrink-0">
          <div class="card overflow-hidden">
            <Poster src={COVER[item.title] ?? null} title={item.title} />
          </div>
          <p class="font-display mt-1.5 truncate text-xs font-semibold">
            {item.title}
          </p>
          <div class="bg-surface-2 mt-1 h-1 overflow-hidden rounded-full">
            <div class="bg-accent h-full" style={`width: ${item.progress}%`}>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm mt-2 w-full">
            {item.next}
          </button>
        </div>
      {/each}
    </div>
  </div>
</section>
