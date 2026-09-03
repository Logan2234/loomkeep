<script lang="ts">
  // Ringed glyph standing in for a badge. The ring carries the tier actually
  // reached — a locked achievement keeps the neutral border, so a family's
  // state reads from across the grid.
  import Icon from "$lib/components/Icon.svelte";
  import type { IconName } from "$lib/types/icon-name";
  import type { AchievementTier } from "@loomkeep/shared";

  let {
    icon,
    tier,
    size = "md",
  }: {
    icon: IconName;
    tier: AchievementTier | null;
    size?: "sm" | "md" | "lg";
  } = $props();

  const RING: Record<AchievementTier, string> = {
    bronze: "border-tier-bronze text-tier-bronze",
    silver: "border-tier-silver text-tier-silver",
    gold: "border-tier-gold text-tier-gold",
  };
  const BOX = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-14 w-14" };
  const GLYPH = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };

  const ring = $derived(tier ? RING[tier] : "border-border text-dim");
</script>

<span
  class="bg-bg grid shrink-0 place-items-center rounded-full border-2 {BOX[
    size
  ]} {ring}">
  <Icon name={icon} class={GLYPH[size]} />
</span>
