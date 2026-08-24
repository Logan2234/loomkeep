<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { scale } from "svelte/transition";

  const reduced = prefersReducedMotion();
</script>

<span
  transition:scale|global={{ duration: reduced ? 0 : 200, start: 0.6 }}
  class="bg-accent text-accent-fg rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
  {m.common_new()}
</span>
