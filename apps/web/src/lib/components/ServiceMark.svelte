<script lang="ts">
  import { SERVICE_BRANDS } from "#lib/service-brands.js";
  import type { GameStore, ListenService } from "@loomkeep/shared/contracts";

  let {
    service,
    class: className = "h-5 w-5",
  }: { service: GameStore | ListenService; class?: string } = $props();

  const mark = $derived(SERVICE_BRANDS[service].mark);
</script>

{#if mark.kind === "logo"}
  <svg
    viewBox="0 0 24 24"
    class="shrink-0 {className}"
    fill={mark.color ?? "currentColor"}
    aria-hidden="true">
    <path d={mark.path} />
  </svg>
{:else}
  <span
    class="inline-grid shrink-0 place-items-center rounded-md text-[0.6rem] font-black {className}"
    style:background-color={mark.color}
    style:color={mark.foreground}
    aria-hidden="true">
    {mark.text}
  </span>
{/if}
