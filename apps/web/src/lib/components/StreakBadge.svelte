<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import {
    compareToLastKnown,
    readLastKnown,
    writeLastKnown,
  } from "$lib/last-known";
  import { m } from "$lib/paraglide/messages.js";

  let {
    days,
    securedToday,
    isSelf = false,
    trackKey,
  }: {
    days: number | undefined;
    /**
     * Whether today already has a watch counted toward the streak — absent
     * wherever the caller doesn't compute the richer profile activity stats
     * (there is no "at risk" state without it, since there's nothing to know
     * you'd need to act on).
     */
    securedToday?: boolean;
    /**
     * The "about to lose it" state is only ever shown to the streak's own
     * owner — a countdown on a stranger's streak isn't your call to action
     * to make anything of.
     */
    isSelf?: boolean;
    /**
     * Storage key enabling the [G6] rise animation, e.g. `streak:<userId>`.
     * Left unset wherever the badge annotates *someone else's* line (review
     * and comment authors): a stranger's streak moving is not news.
     */
    trackKey?: string;
  } = $props();

  // Rise only, never a fall. A shorter streak updates the stored value in
  // silence — the "no loss pressure" guardrail is explicit that losing a
  // streak is never notified. Same last-known-value mechanism as the
  // level-up bubble, shared through $lib/last-known.
  const RISE_MS = 900;
  let rising = $state(false);
  $effect(() => {
    if (!trackKey || !days || days <= 0) return;

    const change = compareToLastKnown(readLastKnown(trackKey), days);
    writeLastKnown(trackKey, days);
    if (change !== "up") return;

    rising = true;
    const timer = setTimeout(() => (rising = false), RISE_MS);
    return () => clearTimeout(timer);
  });

  // [G10] Explicitly not a "no loss pressure" violation by oversight — Logan
  // deliberately chose this for the streak specifically (2026-09-11),
  // overriding the [G10] ticket's own default: a clock only in the last 4h
  // of the viewer's local day, only on the streak's own page, only while it
  // still needs today's watch. Re-evaluated every minute so it appears
  // without needing a reload right at the 4h mark.
  const AT_RISK_WINDOW_HOURS = 4;
  const RECHECK_MS = 60_000;
  let hoursLeftToday = $state(hoursUntilMidnight());
  $effect(() => {
    const timer = setInterval(() => {
      hoursLeftToday = hoursUntilMidnight();
    }, RECHECK_MS);
    return () => clearInterval(timer);
  });

  function hoursUntilMidnight(): number {
    const now = new Date();
    return 24 - (now.getHours() + now.getMinutes() / 60);
  }

  const atRisk = $derived(
    isSelf &&
      securedToday === false &&
      !!days &&
      days > 0 &&
      hoursLeftToday <= AT_RISK_WINDOW_HOURS,
  );

  // Two complete sentences, never concatenated — the urgent one doesn't
  // restate the count (already right there on the badge), and stitching
  // two independently-translated fragments together rarely reads as one
  // real sentence once translated.
  const title = $derived.by(() => {
    if (!days) return "";
    if (atRisk) return m.streak_at_risk();
    return days === 1
      ? m.streak_days_one({ days })
      : m.streak_days_many({ days });
  });
</script>

{#if days && days > 0}
  <span
    class="border-accent/40 bg-accent/10 text-accent inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-1.5 align-middle text-xs font-bold"
    {title}>
    <Icon name="flame" class="h-3 w-3 {rising ? 'streak-rise' : ''}" />
    {days}
    {#if atRisk}
      <Icon name="hourglass" class="text-warning h-3 w-3" />
    {/if}
  </span>
{/if}

<style>
  /* :global — the class lands on Icon's own <svg>, a child component's
     markup, not an element in this component's own template, so scoped CSS
     would never match it. prefers-reduced-motion is handled globally in
     app.css (every animation duration forced near-zero). */
  :global(.streak-rise) {
    animation: streak-rise 700ms ease-out;
  }

  @keyframes streak-rise {
    0% {
      transform: scale(1);
    }
    30% {
      transform: scale(1.35) rotate(-6deg);
    }
    60% {
      transform: scale(0.96) rotate(3deg);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
