<script lang="ts">
  // Séance signature for the reading goal: a projector light-meter dial
  // (round, not the rectangular "marquee cartouche" ratings use — a
  // deliberately distinct read for "progress toward a target" vs. "a score")
  // with the fraction set in timecode mono, echoing DESIGN.md's own
  // "12 / 24" progress convention.
  let {
    completed,
    target,
    size = 22,
  }: { completed: number; target: number; size?: number } = $props();

  const stroke = 2.5;
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const pct = $derived(target > 0 ? Math.min(1, completed / target) : 0);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  class="shrink-0 -rotate-90"
  aria-hidden="true">
  <circle
    cx={size / 2}
    cy={size / 2}
    {r}
    fill="none"
    stroke="currentColor"
    class="text-border"
    stroke-width={stroke} />
  <circle
    cx={size / 2}
    cy={size / 2}
    {r}
    fill="none"
    stroke="currentColor"
    class="text-accent transition-[stroke-dashoffset]"
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-dasharray={c}
    stroke-dashoffset={c * (1 - pct)} />
</svg>
