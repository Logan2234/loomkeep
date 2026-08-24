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

  // Starts empty and animates to the real value a frame after mount (rather
  // than appearing already filled) — the ring's own `transition:` then
  // animates every later change (a book finished, the target edited) too.
  let displayPct = $state(0);
  $effect(() => {
    const target = pct; // read synchronously so the effect re-runs on change
    // Double rAF: a single one can race the element's very first paint, so
    // the "0%" starting point never actually gets painted before it jumps to
    // the target — the second frame guarantees that first paint happens.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => (displayPct = target));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  });
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
    class="text-accent transition-[stroke-dashoffset] duration-500 ease-out"
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-dasharray={c}
    stroke-dashoffset={c * (1 - displayPct)} />
</svg>
