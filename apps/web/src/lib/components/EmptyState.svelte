<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    class: cls = "",
    children,
  }: {
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div
  class="border-border text-dim rounded-xl border border-dashed px-6 py-16 text-center {cls}">
  {@render children()}
</div>
