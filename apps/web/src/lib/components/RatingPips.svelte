<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // 0–10 rating as 11 tappable pips. Emits integers; "0" is a real score, so a
  // separate "effacer" clears back to unrated (null) — the distinction a bare
  // number input can't make. Legacy half-point values are shown on the nearest
  // pip (rounded), and any new pick writes an integer.
  let {
    value = null,
    onChange,
  }: {
    value?: number | null;
    onChange: (value: number | null) => void;
  } = $props();

  const pips = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Rounded so a legacy 8.5 lights the "9" pip; picking always yields an integer.
  const selected = $derived(value === null ? null : Math.round(value));
  let hovered = $state<number | null>(null);

  function previewClass(n: number, on: boolean, lit: boolean) {
    if (on) {
      return "bg-accent text-accent-fg border-transparent";
    }

    if (lit) {
      return "border-accent/30 bg-accent/15 text-fg";
    }

    if (n === hovered) {
      return "border-accent/50 bg-accent/25 text-fg";
    } else if (hovered !== null && n < hovered) {
      return "border-accent/30 bg-accent/15 text-fg";
    }

    return "border-border bg-surface-2 text-dim hover:border-accent/55 hover:text-fg";
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
      >{m.reviews_my_rating()}</span>
  </div>
  <div
    class="grid grid-cols-11 gap-1"
    role="group"
    aria-label={m.reviews_rating_out_of_ten()}>
    {#each pips as n (n)}
      {@const on = selected === n}
      {@const lit = selected !== null && n < selected}
      {@const className = previewClass(n, on, lit)}
      <button
        type="button"
        aria-pressed={on}
        aria-label={m.reviews_rating_value({ rating: n })}
        class={`h-8 rounded-lg border font-mono text-sm font-bold transition-colors ${className}`}
        onclick={() => (value !== n ? onChange(n) : onChange(null))}
        onmouseenter={() => (hovered = n)}
        onmouseleave={() => (hovered = null)}
        onfocus={() => (hovered = n)}
        onblur={() => (hovered = null)}>
        {n}
      </button>
    {/each}
  </div>
</div>
