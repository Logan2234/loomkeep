<script lang="ts">
  // One card per achievement family. Everything essential is on it at rest —
  // medallion, tier pips, name, description, progress, next XP; hovering (or
  // focusing) only *deepens* it with the tier ladder.
  //
  // The unfold panel is a DOM child of the card so moving the cursor down
  // into it never leaves the hover target, and absolutely positioned so the
  // grid never reflows when it opens. Below `md` it stays hidden and the
  // parent opens a drawer with the same content instead.
  //
  // The card is a button *only* on compact viewports, where the tap is the
  // only way in. On desktop hovering already shows everything, so there is
  // nothing to click: it stays a plain container, focusable so the keyboard
  // gets the same unfold as the mouse. A generic <div> carries the button
  // role rather than a real <button> (whose content model forbids the flow
  // content inside: the progress bar, the ladder) or an <article> (which has
  // a landmark role of its own, and may not be repurposed as a button).
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { formatNumber } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { AchievementGroup } from "../achievements";
  import {
    achievementDescription,
    achievementName,
    groupIcon,
  } from "../labels";
  import AchievementLadder from "./AchievementLadder.svelte";
  import AchievementMedallion from "./AchievementMedallion.svelte";
  import TierPips from "./TierPips.svelte";

  let {
    group,
    onselect,
    highlighted = false,
  }: {
    group: AchievementGroup;
    /** Set only on compact viewports, where a tap opens the drawer. */
    onselect?: () => void;
    /** The card the [G6] bubble deep-linked to: scrolled to and flashed once. */
    highlighted?: boolean;
  } = $props();

  // The flash fades on its own — a highlight that stays on would read as a
  // permanent state of the card rather than "here, this one".
  const FLASH_MS = 2400;
  let node = $state<HTMLDivElement | null>(null);
  let flashing = $state(false);
  $effect(() => {
    if (!highlighted || !node) return;

    node.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    flashing = true;
    const timer = setTimeout(() => (flashing = false), FLASH_MS);
    return () => clearTimeout(timer);
  });

  // The card speaks for the tier still to earn — its threshold is what the
  // rail counts towards and its reward is the XP on offer. Once every tier
  // is earned, the last one is what there is left to say.
  const focusEntry = $derived(group.next ?? group.entries.at(-1)!);
  const progress = $derived(focusEntry.progress);
  // Nothing left to earn: the rail would count past its own target (54 / 30),
  // so the card states the fact instead.
  const complete = $derived(group.next === null);

  // The XP figure answers "what did this pay?" once something is earned —
  // the tier actually reached, accented — and "what is on offer?" while it
  // is not, in the quiet voice of an unclaimed reward.
  const earned = $derived(group.entries.filter((e) => e.unlocked).at(-1));
  const xpEntry = $derived(earned ?? focusEntry);

  function onkeydown(event: KeyboardEvent) {
    if (!onselect) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onselect();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- Focusable without being interactive on desktop, on purpose: the card
     isn't clickable there (hovering already reveals everything), but the
     tier ladder has to stay reachable for someone who doesn't use a mouse,
     and `:focus-visible` is what opens it. -->
<div
  bind:this={node}
  class="achievement-card card relative flex min-h-40 flex-col gap-2 overflow-visible p-3.5 {flashing
    ? 'achievement-flash'
    : ''}"
  role={onselect ? "button" : undefined}
  tabindex="0"
  aria-label={achievementName(focusEntry)}
  onclick={onselect}
  {onkeydown}>
  <div class="flex items-start justify-between gap-2.5">
    <AchievementMedallion icon={groupIcon(group)} tier={group.reachedTier} />
    <TierPips entries={group.entries} />
  </div>

  <h3 class="font-display text-fg text-sm leading-tight font-bold">
    {achievementName(focusEntry)}
  </h3>
  <p class="text-dim text-xs leading-snug">
    {achievementDescription(focusEntry)}
  </p>

  <div class="mt-auto flex flex-col gap-1.5">
    {#if progress && !complete}
      <ProgressBar
        value={(progress.current / progress.target) * 100}
        height="h-1"
        track="bg-border"
        rounded={false} />
    {/if}
    <div class="flex items-baseline justify-between gap-2">
      {#if complete}
        <span
          class="border-accent text-accent rounded-full border px-2 py-0.5 text-[0.6rem] font-bold tracking-wide uppercase">
          {m.gamification_stamp_unlocked()}
        </span>
      {:else if progress}
        <span class="timecode text-xs">
          {formatNumber(progress.current)} / {formatNumber(progress.target)}
        </span>
      {:else}
        <span class="timecode text-xs">—</span>
      {/if}
      <span class="timecode text-xs {earned ? 'text-accent' : ''}">
        {xpEntry.xpAward === null
          ? m.gamification_xp_unknown()
          : m.gamification_xp_award({ xp: formatNumber(xpEntry.xpAward) })}
      </span>
    </div>
  </div>

  <div
    class="achievement-unfold border-accent bg-surface-2 absolute -right-px -left-px z-10 hidden overflow-hidden border border-t-0 md:block">
    <AchievementLadder {group} />
  </div>
</div>

<style>
  /* Closed by default; the card's own hover/focus opens it. Kept out of
     Tailwind utilities because it needs `:hover`/`:focus-visible` on the card
     to drive a *descendant*, which utility classes can't express.
     prefers-reduced-motion is handled globally in app.css. */
  .achievement-unfold {
    /* Overlaps the card's bottom border by a pixel rather than sitting flush
       against it: at fractional zoom levels `top: 100%` rounds to a hairline
       gap between the two. */
    top: calc(100% - 1px);
    max-height: 0;
    padding: 0 0.75rem;
    opacity: 0;
    pointer-events: none;
    /* Continues the card rather than floating under it: square where the two
       meet, rounded where the panel now ends. */
    border-bottom-left-radius: 0.75rem; /* matches .card's rounded-xl */
    border-bottom-right-radius: 0.75rem;
    transition:
      max-height 180ms ease,
      padding 180ms ease,
      opacity 130ms ease;
  }

  /* `:focus-within` is deliberately absent: it also matches the focus a
     mouse click leaves behind, which kept the ladder open after the cursor
     had moved away. `:focus-visible` is the one that means "arrived here by
     keyboard", which is the case this needs to serve. */
  .achievement-card:hover .achievement-unfold,
  .achievement-card:focus-visible .achievement-unfold {
    max-height: 22rem;
    padding: 0.7rem 0.75rem 0.8rem;
    opacity: 1;
    pointer-events: auto;
  }

  .achievement-card {
    transition:
      opacity 170ms ease,
      border-color 170ms ease,
      border-radius 170ms ease,
      box-shadow 170ms ease;
  }

  /* The deep-linked card announces itself, then lets go. Ring + border only:
     anything moving would fight the cascade of bars filling around it.
     prefers-reduced-motion is handled globally in app.css. */
  .achievement-flash {
    animation: achievement-flash 2.4s ease-out;
  }

  @keyframes achievement-flash {
    0%,
    45% {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 34%, transparent);
    }
    100% {
      border-color: var(--border);
      box-shadow: 0 0 0 3px transparent;
    }
  }

  /* The open card and its panel read as one object — no seam, no leftover
     rounding between them. */
  .achievement-card:hover,
  .achievement-card:focus-visible {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
</style>
