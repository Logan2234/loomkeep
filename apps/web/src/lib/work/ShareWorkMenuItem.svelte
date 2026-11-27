<script lang="ts">
  // "Partager" in a work page's "…" menu.
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "../ui/Icon.svelte";

  let {
    onclick,
    separated = false,
  }: {
    onclick: () => void;
    /** Opens its group, after the status actions. */
    separated?: boolean;
  } = $props();
</script>

<button
  role="menuitem"
  type="button"
  class="menu-item {separated ? 'border-border border-t' : ''}"
  {onclick}>
  <Icon name="share" class="h-4 w-4" />
  {m.common_share()}
</button>
