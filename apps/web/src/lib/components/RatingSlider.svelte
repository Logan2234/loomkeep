<script lang="ts">
  import { ratingWord } from "$lib/rating-words";
  import { m } from "$lib/paraglide/messages.js";
  import RollingNumber from "./RollingNumber.svelte";

  // 0–10 rating as a native range input, so keyboard and screen readers work
  // out of the box. "0" is a real score, so "Retirer la note" clears back to
  // unrated (null) — a range input alone can't represent "no value". Legacy
  // half-point values are shown rounded; any new pick writes an integer.
  let {
    value = null,
    onChange,
  }: {
    value?: number | null;
    onChange: (value: number | null) => void;
  } = $props();

  const TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const UNSET_POSITION = 5;

  const selected = $derived(value === null ? null : Math.round(value));
  const word = $derived(selected === null ? null : ratingWord(selected));

  function pick(e: Event) {
    onChange(Number((e.currentTarget as HTMLInputElement).value));
  }

  const SLIDER_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
  ]);

  // While unrated the thumb is hidden and parked mid-track, so the native
  // step would jump straight to 4 or 6: the first key press lands on the
  // middle instead (Home/End still go to the ends).
  function startFromKeyboard(e: KeyboardEvent) {
    if (selected !== null || !SLIDER_KEYS.has(e.key)) return;
    e.preventDefault();
    onChange(e.key === "Home" ? 0 : e.key === "End" ? 10 : UNSET_POSITION);
  }

  // A click on the parked position changes nothing, so no `input` fires.
  function startFromPointer(e: PointerEvent) {
    if (selected === null) pick(e);
  }
</script>

<div>
  <div class="flex items-center justify-between">
    <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
      {m.reviews_my_rating()}
    </span>
    {#if selected !== null}
      <button type="button" class="btn-text" onclick={() => onChange(null)}>
        {m.reviews_rating_clear()}
      </button>
    {/if}
  </div>

  <div class="flex min-h-16 items-baseline gap-2.5" aria-hidden="true">
    <span
      class="font-display text-[3.4rem] leading-none font-extrabold tracking-[-0.02em] tabular-nums"
      class:text-border={selected === null}>
      <RollingNumber value={selected} />
    </span>
    <span class="timecode text-[0.95rem]">/10</span>
    <span
      class="ml-auto text-right"
      class:text-accent={word}
      class:font-semibold={word}
      class:text-dim={!word}>
      {word ?? m.reviews_rating_drag_hint()}
    </span>
  </div>

  <input
    type="range"
    min="0"
    max="10"
    step="1"
    class="rating-range"
    class:unset={selected === null}
    style="--p: {selected === null ? 0 : selected * 10}%"
    value={selected ?? UNSET_POSITION}
    aria-label={m.reviews_rating_out_of_ten()}
    aria-valuetext={selected === null
      ? m.reviews_rating_unrated()
      : m.reviews_rating_value_word({ rating: selected, word: word! })}
    oninput={pick}
    onkeydown={startFromKeyboard}
    onpointerup={startFromPointer} />

  <div class="mt-0.5 flex justify-between px-[7px]" aria-hidden="true">
    {#each TICKS as n (n)}
      <span
        class="w-3 text-center font-mono text-[0.66rem] tabular-nums"
        class:text-accent={n === selected}
        class:font-bold={n === selected}
        class:text-dim={n !== selected}>
        {n}
      </span>
    {/each}
  </div>
</div>

<style>
  .rating-range {
    appearance: none;
    width: 100%;
    height: 28px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .rating-range::-webkit-slider-runnable-track {
    height: 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--accent) var(--p),
      var(--surface-2) var(--p)
    );
  }

  .rating-range::-moz-range-track {
    height: 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--accent) var(--p),
      var(--surface-2) var(--p)
    );
  }

  .rating-range::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -9px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.25);
  }

  .rating-range::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.25);
  }

  .rating-range.unset::-webkit-slider-thumb {
    opacity: 0;
  }

  .rating-range.unset::-moz-range-thumb {
    opacity: 0;
  }

  .rating-range.unset:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 999px;
  }

  .rating-range:focus-visible {
    outline: none;
  }

  .rating-range:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .rating-range:focus-visible::-moz-range-thumb {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
