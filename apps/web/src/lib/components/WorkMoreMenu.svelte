<script lang="ts">
  // The "…" of a work not tracked yet: tracking adds its own menu, with more
  // in it.
  import { m } from "#lib/paraglide/messages.js";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";
  import ShareWorkMenuItem from "./ShareWorkMenuItem.svelte";

  let { onshare }: { onshare: () => void } = $props();
</script>

<Dropdown placement="bottom-end" class="min-w-56">
  {#snippet trigger({ open, toggle, onkeydown })}
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      {onkeydown}
      aria-label={m.common_more_actions()}
      title={m.common_more_actions()}
      onclick={toggle}
      class="btn-icon border-border h-9 w-9 border transition-colors">
      <Icon name="dots-horizontal" class="h-4 w-4" />
    </button>
  {/snippet}
  {#snippet children({ close })}
    <ShareWorkMenuItem
      onclick={() => {
        close();
        onshare();
      }} />
  {/snippet}
</Dropdown>
