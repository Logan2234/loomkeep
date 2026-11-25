<script lang="ts">
  import { CopyFeedback } from "#lib/clipboard.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";

  // One subscription URL, shown whole so it can be checked, and selected in
  // one click (`select-all`) for whoever pastes rather than copies.
  let { url, label, hint }: { url: string; label?: string; hint?: Snippet } =
    $props();

  const copyFeedback = new CopyFeedback();
  $effect(() => () => copyFeedback.reset());
</script>

<div class="flex flex-col gap-1.5">
  {#if label}
    <p class="text-sm font-semibold">{label}</p>
  {/if}
  <div
    class="bg-surface-2 flex min-w-0 items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-3">
    <code class="min-w-0 flex-1 truncate py-1 text-xs select-all">{url}</code>
    <button
      type="button"
      class="btn btn-ghost btn-sm shrink-0"
      onclick={() => copyFeedback.copy(url, true)}>
      <Icon name={copyFeedback.value ? "check" : "link"} class="h-4 w-4" />
      {copyFeedback.value ? m.common_link_copied() : m.common_copy_link()}
    </button>
  </div>
  {#if hint}
    <div class="text-dim text-xs">{@render hint()}</div>
  {/if}
</div>
