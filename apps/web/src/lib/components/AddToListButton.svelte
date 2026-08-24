<script lang="ts">
  import type { ListItemTargetType } from "@loomkeep/shared";
  import { m } from "$lib/paraglide/messages.js";
  import AddToListModal from "./AddToListModal.svelte";
  import Icon from "./Icon.svelte";

  // Per-work "add to a list" entry point for the 4 detail pages — opens a
  // checklist of the viewer's own lists (AddToListModal). Managing your own
  // lists always works, even with social off (mirrors reviews/comments'
  // own-content-ungated split), so this button is never social-gated.
  let {
    targetType,
    targetId,
  }: { targetType: ListItemTargetType; targetId: string } = $props();

  let open = $state(false);
</script>

<button
  class="btn btn-ghost h-9 w-9 rounded-full p-0 sm:h-auto sm:w-auto sm:rounded-lg sm:px-4 sm:py-2"
  title={m.add_to_list_button()}
  onclick={() => (open = true)}>
  <Icon name="list" class="h-4 w-4" />
  <span class="hidden sm:inline">{m.add_to_list_button()}</span>
</button>

{#if open}
  <AddToListModal {targetType} {targetId} onClose={() => (open = false)} />
{/if}
