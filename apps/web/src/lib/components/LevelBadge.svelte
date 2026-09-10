<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { levelProgress } from "@loomkeep/shared";

  let { xp }: { xp: number | null | undefined } = $props();

  const level = $derived(
    xp === undefined || xp === null ? undefined : levelProgress(xp).level,
  );
</script>

{#if xp !== undefined && xp !== null}
  <span
    class="text-accent inline-flex items-center font-mono text-xs font-bold"
    title={m.profile_level_full({ level: level! })}>
    {m.profile_level_badge({ level: level! })}
  </span>
{/if}
