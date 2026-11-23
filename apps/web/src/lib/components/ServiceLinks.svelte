<script lang="ts">
  import { SERVICE_BRANDS } from "#lib/service-brands.js";
  import type { GameStore, ListenService } from "@loomkeep/shared";

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
        class="border-border bg-surface hover:bg-surface-2 inline-flex items-center gap-2 rounded-lg border py-1 pr-2.5 pl-1 text-sm font-semibold transition-colors duration-150">
        <span
          class="inline-grid h-6 w-6 place-items-center rounded-md text-[0.65rem] font-black"
          style:background-color={brand.color}
          style:color={brand.foreground}
          aria-hidden="true">
          {brand.monogram}
        </span>
        {brand.name}
      </a>
    </li>
  {/each}
</ul>
