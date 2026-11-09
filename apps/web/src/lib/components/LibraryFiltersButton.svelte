<script lang="ts">
  // Opens a library's "Filtres et affichage" panel, with how many of its
  // filters are on.
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";

  let {
    count,
    expanded,
    onclick,
  }: {
    /** The panel's filters in use. */
    count: number;
    expanded: boolean;
    onclick: () => void;
  } = $props();
</script>

<button
  type="button"
  class="bg-surface-2 hover:bg-border relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1"
  aria-label={count > 0 ? m.library_filters_active({ count }) : undefined}
  aria-haspopup="dialog"
  aria-expanded={expanded}
  {onclick}>
  <Icon name="sliders" class="h-4 w-4" />
  {m.common_filters()}
  {#if count > 0}
    <span
      class="bg-accent text-accent-fg grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 font-mono text-[0.62rem] font-bold">
      {count}
    </span>
  {/if}
  {#if isFeatureNew("library-filters")}
    <!-- A dot on a phone, where the pills need the width. -->
    {#if layout.compact}
      <span
        class="bg-accent ring-bg absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2"
        aria-hidden="true"></span>
    {:else}
      <NewBadge />
    {/if}
  {/if}
</button>
