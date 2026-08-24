<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";

  const reduced = prefersReducedMotion();

  type Variant = "error" | "warning" | "info" | "neutral";

  const VARIANT_CLASSES: Record<Variant, string> = {
    error: "border-danger/40 bg-danger/10 text-danger",
    warning: "border-accent/40 bg-accent/10 text-accent",
    info: "border-border bg-surface-2 text-fg",
    neutral: "border-border bg-surface-2 text-dim",
  };

  let {
    variant = "info",
    class: cls = "",
    children,
  }: {
    variant?: Variant;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div
  in:slide|global={{ duration: reduced ? 0 : 150 }}
  class="rounded-lg border px-4 py-3 text-sm {VARIANT_CLASSES[variant]} {cls}">
  {@render children()}
</div>
