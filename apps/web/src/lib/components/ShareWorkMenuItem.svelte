<script lang="ts">
  // "Partager" in a work page's "…" menu.
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";

  let { onclick }: { onclick: () => void } = $props();
</script>

<button role="menuitem" type="button" class="menu-item" {onclick}>
  <Icon name="share" class="h-4 w-4" />
  {m.common_share()}
  {#if isFeatureNew("share-work")}
    <span class="ml-auto"><NewBadge /></span>
  {/if}
</button>
