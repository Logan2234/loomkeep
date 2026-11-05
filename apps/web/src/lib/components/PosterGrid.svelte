<script lang="ts">
  // Responsive grid shared by every poster listing (books/games/media) and
  // their loading skeletons. A library picks its poster size; the catalogue
  // listings keep the default columns.
  import type { LibraryPosterSize } from "#lib/library-view.js";
  import type { Snippet } from "svelte";

  let { children, size }: { children: Snippet; size?: LibraryPosterSize } =
    $props();

  const COLUMNS: Record<LibraryPosterSize, string> = {
    large:
      "grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 md:gap-x-4 md:gap-y-6 lg:grid-cols-6",
    small:
      "grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-6 md:gap-x-3 md:gap-y-5 lg:grid-cols-8",
  };
</script>

<div
  class="grid {size
    ? COLUMNS[size]
    : 'grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}">
  {@render children()}
</div>
