<script lang="ts">
  import type { Snippet } from "svelte";
  import { m } from "#lib/paraglide/messages.js";
  let { children, footer }: { children: Snippet; footer?: Snippet } = $props();
</script>

<div class="card p-4">
  <h2 class="font-display text-sm font-bold tracking-tight">
    {m.common_details()}
  </h2>
  <dl class="mt-3 flex flex-col gap-3">{@render children()}</dl>
  {@render footer?.()}
</div>
