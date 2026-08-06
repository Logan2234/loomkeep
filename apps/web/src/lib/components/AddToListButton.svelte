<script lang="ts">
  import type { ListItemTargetType } from "@loomkeep/shared";
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

<button class="btn btn-ghost" onclick={() => (open = true)}>
  <Icon name="list" class="h-4 w-4" /> Ajouter à une liste
</button>

{#if open}
  <AddToListModal {targetType} {targetId} onClose={() => (open = false)} />
{/if}
