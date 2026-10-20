<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    class: cls = "",
    children,
    padding = "py-16",
  }: {
    class?: string;
    children: Snippet;
    padding?: "py-12" | "py-14" | "py-16";
  } = $props();
</script>

<div
  class="border-border text-dim rounded-xl border border-dashed px-6 {padding} text-center {cls}">
  {@render children()}
</div>
