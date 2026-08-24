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
</script>

<div
  class="{track} {height} overflow-hidden {rounded
    ? 'rounded-full'
    : ''} {cls}">
  <div
    class="progress-fill {fillClass} h-full {rounded ? 'rounded-full' : ''}"
    style="width: {clamped}%; {fillStyle}"
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
