<script lang="ts">
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { scale } from "svelte/transition";

  const reduced = prefersReducedMotion();
</script>

<span
  in:scale|global={{ duration: reduced ? 0 : 200, start: 0.6 }}
  class="bg-accent text-accent-fg rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase max-[359px]:inline-block max-[359px]:h-2 max-[359px]:w-2 max-[359px]:p-0">
  <!-- Under 360px, where the word would take a title's room, only a dot. -->
  <span class="max-[359px]:sr-only">{m.common_new()}</span>
</span>
