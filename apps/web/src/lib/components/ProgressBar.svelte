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

  // [G6] point 3: reaching the end gets a brief accent — the bar already
  // animates its width, this is what turns "the fill stopped moving" into
  // "that's finished". It is what marks a season/series completed, so it
  // lives on the shared bar rather than at one call site: every rail that
  // fills up (a tier's progress, a reading goal) earns the same beat.
  //
  // Only a *transition* to 100 counts — a bar that mounts already full has
  // nothing to celebrate, hence the null first pass.
  const COMPLETE_TOTAL_MS = 820;
  let completing = $state(false);
  let previous: number | null = null;
  $effect(() => {
    const target = clamped;
    const justCompleted = previous !== null && previous < 100 && target >= 100;
    previous = target;
    if (!justCompleted) return;

    completing = true;
    const timer = setTimeout(() => (completing = false), COMPLETE_TOTAL_MS);
    return () => clearTimeout(timer);
  });
</script>

<div
  class="{track} {height} overflow-hidden {rounded
    ? 'rounded-full'
    : ''} {cls}">
  <div
    class="progress-fill {fillClass} h-full {rounded
      ? 'rounded-full'
      : ''} {completing ? 'progress-complete' : ''}"
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

  /* Delayed by the width transition above, so the accent lands as the fill
     reaches the end rather than racing it. Brightness + a short glow, no
     scaling: the bar must not shift the layout around it. */
  .progress-complete {
    animation: progress-complete 520ms ease-out 300ms;
  }

  @keyframes progress-complete {
    0% {
      filter: none;
    }
    35% {
      filter: brightness(1.45)
        drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 70%, transparent));
    }
    100% {
      filter: none;
    }
  }
</style>
