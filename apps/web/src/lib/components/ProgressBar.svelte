<script lang="ts">
  // Shared linear progress bar (reading/watch progress, import jobs, wizard
  // steps, admin quota gauges...). The fill's width transitions via plain
  // CSS, so it animates on its own whenever `value` changes — no extra work
  // needed at the call site when items are added/removed and a computed
  // percentage moves as a result.
  let {
    value,
    height = "h-1.5",
    track = "bg-surface-2",
    fillClass = "bg-accent",
    fillStyle = "",
    rounded = true,
    title,
    class: cls = "",
  }: {
    /** 0-100. */
    value: number;
    /** Tailwind height class for the track/fill. */
    height?: string;
    /** Tailwind class for the track background. */
    track?: string;
    /** Tailwind class for the fill background — override for e.g. a
     * threshold-based color (danger past a quota). */
    fillClass?: string;
    /** Raw inline style appended to the fill, for an arbitrary CSS color
     * (e.g. a per-item stat color) that isn't a Tailwind class. */
    fillStyle?: string;
    rounded?: boolean;
    /** Tooltip on the fill, e.g. "6 / 62 episodes". */
    title?: string;
    class?: string;
  } = $props();

  const clamped = $derived(Math.max(0, Math.min(100, value)));

  // Starts empty and animates to the real value a frame after mount (rather
  // than appearing already filled) — the fill's own `transition:` then
  // animates every later change (an item added/removed shifting the %) too.
  let displayValue = $state(0);
  $effect(() => {
    const target = clamped; // read synchronously so the effect re-runs on change
    // Double rAF: a single one can race the element's very first paint (no
    // loading state means the bar can mount already showing real data), so
    // the "0%" starting point never actually gets painted before it jumps to
    // the target — the second frame guarantees that first paint happens.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => (displayValue = target));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  });
</script>

<div
  class="{track} {height} overflow-hidden {rounded
    ? 'rounded-full'
    : ''} {cls}">
  <div
    class="progress-fill {fillClass} h-full {rounded ? 'rounded-full' : ''}"
    style="width: {displayValue}%; {fillStyle}"
    {title}>
  </div>
</div>

<style>
  /* prefers-reduced-motion is handled globally in app.css (forces every
     transition/animation duration near-zero). */
  .progress-fill {
    transition: width 300ms ease-out;
  }
</style>
