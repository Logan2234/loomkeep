<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { prefersReducedMotion } from "$lib/motion";
  import { levelProgress } from "@loomkeep/shared";
  import { scale } from "svelte/transition";

  let { xp }: { xp: number | null | undefined } = $props();

  const reduced = prefersReducedMotion();
  const level = $derived(
    xp === undefined || xp === null ? undefined : levelProgress(xp).level,
  );
</script>

{#if xp !== undefined && xp !== null}
  <span
    in:scale|global={{ duration: reduced ? 0 : 200, start: 0.6 }}
    class="text-accent inline-flex items-center font-mono text-xs font-bold"
    title={m.profile_level_full({ level: level! })}>
    {m.profile_level_badge({ level: level! })}
  </span>
{/if}
