<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { currentHomeGate } from "$lib/home/gate";
  import {
    DEFAULT_QUICK_LINKS,
    resolveQuickLinks,
  } from "$lib/home/quick-links";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto } from "@loomkeep/shared";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const links = $derived(
    resolveQuickLinks(
      widget.config?.links ?? DEFAULT_QUICK_LINKS,
      currentHomeGate(),
    ),
  );
  // Headerless, like the old home's sidebar block: the links are their own
  // label. A wide widget lays them out in columns.
  const columns = $derived(
    Math.max(1, Math.min(4, Math.floor((size.width - 16) / 220))),
  );
</script>

<section class="card flex h-full min-h-full flex-col overflow-hidden p-2">
  {#if links.length > 0}
    <ul
      class="no-scrollbar grid min-h-0 flex-1 content-start gap-x-2 overflow-y-auto"
      style:grid-template-columns={`repeat(${columns}, minmax(0, 1fr))`}>
      {#each links as link (link.key)}
        <li>
          <a
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            class="hover:bg-surface-2 group flex h-10 items-center gap-3 rounded-lg px-2.5 transition-colors">
            <Icon name={link.icon} class="text-accent h-5 w-5 shrink-0" />
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">
              {link.label}
            </span>
            <Icon
              name={link.external ? "external" : "chevron-right"}
              class="text-dim h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_quick_links_empty()}
    </p>
  {/if}
</section>
