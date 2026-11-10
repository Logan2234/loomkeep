<script lang="ts">
  // A name wired to the peek, and the peek itself, as the app layout mounts it.
  import CreatorPeek from "#lib/creator-peek/CreatorPeek.svelte";
  import { creatorPeek } from "#lib/creator-peek/peek.svelte.js";
</script>

<a
  href="/app/people/tmdb/137427"
  use:creatorPeek={{
    ref: { source: "tmdb", id: "137427", name: "Denis Villeneuve" },
    role: "Director",
  }}>Denis Villeneuve</a>
<CreatorPeek />
