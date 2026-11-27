<script lang="ts">
  import ServiceMark from "#lib/components/ServiceMark.svelte";
  import { SERVICE_BRANDS } from "#lib/service-brands.js";
  import type { GameStore, ListenService } from "@loomkeep/shared/contracts";

  let {
    links,
  }: {
    links: { service: GameStore | ListenService; url: string }[];
  } = $props();
</script>

<ul class="flex flex-wrap gap-2">
  {#each links as link (link.service)}
    {@const brand = SERVICE_BRANDS[link.service]}
    <li>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        class="border-border bg-surface hover:bg-surface-2 inline-flex items-center gap-2 rounded-lg border py-1.5 pr-2.5 pl-2 text-sm font-semibold transition-colors duration-150">
        <ServiceMark service={link.service} />
        {brand.name}
      </a>
    </li>
  {/each}
</ul>
