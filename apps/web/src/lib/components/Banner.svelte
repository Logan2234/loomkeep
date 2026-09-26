<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";
  import {
    bannerRole,
    type BannerLiveMode,
    type BannerVariant,
  } from "./banner-semantics";
  import Icon from "./Icon.svelte";

  const reduced = prefersReducedMotion();

  const VARIANT_CLASSES: Record<BannerVariant, string> = {
    error: "border-danger/40 bg-danger/10 text-fg",
    warning: "border-accent/40 bg-accent/10 text-accent",
    info: "border-border bg-surface-2 text-fg",
    neutral: "border-border bg-surface-2 text-dim",
  };

  let {
    variant = "info",
    live = "auto",
    class: cls = "",
    children,
  }: {
    variant?: BannerVariant;
    live?: BannerLiveMode;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div
  in:slide|global={{ duration: reduced ? 0 : 150 }}
  role={bannerRole(variant, live)}
  aria-atomic={bannerRole(variant, live) ? "true" : undefined}
  class="flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm {VARIANT_CLASSES[
    variant
  ]} {cls}">
  {#if variant === "error" || variant === "warning"}
    <Icon
      name="warning"
      class="mt-0.5 h-4 w-4 shrink-0 {variant === 'error'
        ? 'text-danger'
        : 'text-accent'}" />
  {/if}
  <div class="min-w-0 flex-1">
    {@render children()}
  </div>
</div>
