<script lang="ts">
  // Responsive grid shared by every poster listing (books/games/media) and
  // their loading skeletons.
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div
  class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
  {@render children()}
</div>
