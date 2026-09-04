<script lang="ts">
  // [G6] the unlock bubble: what the app says when you come back and
  // something happened while you were away.
  //
  // Anchored at the *top* and mounted once by app/+layout.svelte. It is
  // neither Toast.svelte (bottom-anchored, several at once, system
  // messages) nor the notification bell — [G2] settled that an unlock
  // creates no `Notification` row at all, on purpose.
  //
  // The trigger is this component mounting, i.e. entering the app. No
  // `visibilitychange`, no live push while the user is mid-action: a bubble
  // dropping in over a click is exactly the interruption the design avoids.
  import { goto } from "$app/navigation";
  import {
    getAchievements,
    getMyProgression,
    getPendingAchievements,
    markAchievementDisplayed,
  } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { formatNumber } from "$lib/format";
  import {
    ENTER_MS,
    EXIT_MS,
    UnlockQueue,
    type UnlockBubble,
  } from "$lib/gamification/unlock-queue";
  import {
    compareToLastKnown,
    readLastKnown,
    writeLastKnown,
  } from "$lib/last-known";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { levelForXp } from "@loomkeep/shared";
  import { backOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { achievementName, entryIcon } from "../achievements/labels";
  import AchievementMedallion from "../achievements/components/AchievementMedallion.svelte";

  const reduced = prefersReducedMotion();

  // Everything gamification-shaped is gated on the instance flag, same
  // pattern as [G4]/[G5]: nothing rendered, nothing requested when it's off.
  const enabled = $derived(appConfig.gamificationEnabled && auth.isLoggedIn);

  const levelKey = $derived(`level:${auth.user?.id ?? ""}`);

  const queue = new UnlockQueue({
    onDisplayed: (bubble) => {
      if (bubble.kind === "achievement") markAchievementDisplayed(bubble.id);
      // The level has no server-side "seen" marker (it isn't even stored —
      // it's derived from XP), so the local high-water mark only moves once
      // its bubble has actually played. Closing the app before then simply
      // replays it next time.
      else writeLastKnown(levelKey, bubble.level);
    },
  });

  let current = $state<UnlockBubble | null>(null);
  $effect(() => queue.subscribe((value) => (current = value)));
  $effect(() => () => queue.destroy());

  const pendingQuery = createApiQuery(() => ({
    key: keys.gamification.pending(),
    fetch: getPendingAchievements,
    enabled,
  }));
  const pending = $derived(pendingQuery.data ?? []);

  // The pending rows carry a bare key; the name, the glyph and the tier ring
  // all live on the catalogue projection, so it is fetched — only when there
  // is actually something to announce. Same query key as the achievements
  // screen, so landing there after a click costs no second round trip.
  const catalogueQuery = createApiQuery(() => ({
    key: keys.gamification.achievements(),
    fetch: getAchievements,
    enabled: enabled && pending.length > 0,
  }));
  const byKey = $derived(
    new Map(
      (catalogueQuery.data ?? [])
        .filter((entry) => entry.key !== null)
        .map((entry) => [entry.key!, entry]),
    ),
  );

  $effect(() => {
    if (pending.length === 0 || byKey.size === 0) return;
    queue.enqueue(
      // An unknown key means the catalogue and the unlock disagree — skip it
      // rather than show a bubble naming a raw registry key. It stays
      // pending, so it gets another chance next time.
      pending
        .filter((row) => byKey.has(row.key))
        .map((row) => ({
          kind: "achievement" as const,
          id: row.id,
          key: row.key,
          xp: row.xpAwarded,
        })),
    );
  });

  // Level-up detection. No mutation returns XP and none is going to start:
  // the level is compared at startup against the last one seen on this
  // device. Reads GET /gamification/me rather than the social profile so a
  // SOCIAL_ENABLED=false instance still gets its levels ("solo first").
  const progressionQuery = createApiQuery(() => ({
    key: keys.gamification.progression(),
    fetch: getMyProgression,
    enabled: enabled && !!auth.user,
  }));

  $effect(() => {
    const xp = progressionQuery.data?.xp;
    if (xp === null || xp === undefined || !auth.user) return;

    const key = levelKey;
    const level = levelForXp(xp);
    const change = compareToLastKnown(readLastKnown(key), level);

    if (change === "up") {
      queue.enqueue([{ kind: "level", id: `level:${level}`, level }]);
    } else if (change !== "same") {
      // "first" (nothing to compare against yet) and "down" (XP is
      // reversible by design) both record the new level without a word —
      // announcing a loss is explicitly out of bounds.
      writeLastKnown(key, level);
    }
  });

  const entry = $derived(
    current?.kind === "achievement" ? (byKey.get(current.key) ?? null) : null,
  );

  function open() {
    const bubble = current;
    if (!bubble) return;

    // A click ends the whole run — the user has decided where to look.
    queue.stop();
    void goto(
      bubble.kind === "achievement"
        ? // Deep link agreed in [G5]'s design: the screen scrolls to this
          // achievement's card and flashes it, instead of dropping the user
          // in front of 42 cards with no clue which one just fired.
          `/app/achievements?unlocked=${encodeURIComponent(bubble.key)}`
        : // A level isn't an achievement — it lives on the profile, where
          // the reel shows it.
          "/app/profile",
    );
  }

  // Swipe up to dismiss, the gesture that matches where the bubble goes.
  // Coarse on purpose (start/end only, no drag-follow): it competes with
  // page scrolling, so anything more elaborate would fight the page.
  const SWIPE_THRESHOLD = 24;
  let touchStartY: number | null = null;

  function ontouchstart(event: TouchEvent) {
    touchStartY = event.touches[0]?.clientY ?? null;
  }

  function ontouchend(event: TouchEvent) {
    const start = touchStartY;
    touchStartY = null;
    const end = event.changedTouches[0]?.clientY;
    if (start === null || end === undefined) return;
    if (start - end > SWIPE_THRESHOLD) queue.dismiss();
  }
</script>

{#if enabled && current}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-70 flex justify-center px-4 pt-3"
    role="status"
    aria-live="polite">
    <!-- The whole bubble is the target: clicking it opens what it announced
         and ends the run. No dismiss button — a prize doesn't ship with a
         "no thanks". Swipe up still dismisses on touch. -->
    <button
      type="button"
      {ontouchstart}
      {ontouchend}
      onclick={open}
      in:fly={{ y: -90, duration: reduced ? 0 : ENTER_MS, easing: backOut }}
      out:fly={{ y: -90, duration: reduced ? 0 : EXIT_MS }}
      class="unlock-bubble border-accent/60 bg-surface pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-xl border py-2.5 pr-4 pl-3 text-left shadow-[0_12px_36px_rgba(0,0,0,.32)] backdrop-blur {reduced
        ? ''
        : 'unlock-bubble-animated'}">
      <!-- A single sweep of light across the card, once, just after it lands
           — the "something was won" beat. Purely decorative. -->
      <span class="unlock-shine" aria-hidden="true"></span>

      <span class="unlock-medal shrink-0">
        {#if current.kind === "achievement" && entry}
          <!-- `?? "gold"` because an untiered achievement carries no tier at
               all, and the medallion's neutral ring is its *locked* look —
               the one thing this bubble must never show. -->
          <AchievementMedallion
            icon={entryIcon(entry)}
            tier={entry.tier ?? "gold"} />
        {:else if current.kind === "level"}
          <!-- The level's own insignia in the medallion's place: same
               footprint, same ring weight, the number instead of a glyph. -->
          <span
            class="border-accent text-accent bg-bg font-display grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-base font-extrabold">
            {current.level}
          </span>
        {/if}
      </span>

      <span class="flex min-w-0 flex-col">
        {#if current.kind === "achievement"}
          <span
            class="text-accent text-[0.6rem] font-semibold tracking-widest uppercase">
            {m.gamification_bubble_unlocked()}
          </span>
          <span class="font-display text-fg truncate text-base font-bold">
            {entry ? achievementName(entry) : ""}
          </span>
          <span class="unlock-reward timecode text-accent text-xs">
            {m.gamification_xp_award({ xp: formatNumber(current.xp) })}
          </span>
        {:else}
          <span
            class="text-accent text-[0.6rem] font-semibold tracking-widest uppercase">
            {m.gamification_bubble_level_reached()}
          </span>
          <span class="font-display text-fg truncate text-base font-bold">
            {m.gamification_bubble_level_title({ level: current.level })}
          </span>
          <!-- No XP line here: the level *is* the XP, restating it would
               say the same thing twice. -->
        {/if}
      </span>
    </button>
  </div>
{/if}

<style>
  /* The celebration, in three beats after the bubble lands: the ring pulses,
     the medal drops into place, the reward arrives last. Everything is
     opt-in through .unlock-bubble-animated, which the component leaves off
     under prefers-reduced-motion — the bubble still appears and is still
     marked as displayed, it just doesn't perform. */
  .unlock-bubble-animated {
    animation: unlock-glow 1.4s ease-out 120ms;
  }

  @keyframes unlock-glow {
    0% {
      box-shadow:
        0 12px 36px rgb(0 0 0 / 0.32),
        0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent);
    }
    35% {
      box-shadow:
        0 12px 36px rgb(0 0 0 / 0.32),
        0 0 26px 4px color-mix(in srgb, var(--accent) 45%, transparent);
    }
    100% {
      box-shadow:
        0 12px 36px rgb(0 0 0 / 0.32),
        0 0 0 0 transparent;
    }
  }

  .unlock-shine {
    position: absolute;
    inset: 0 auto 0 0;
    width: 45%;
    background: linear-gradient(
      100deg,
      transparent,
      color-mix(in srgb, var(--accent) 22%, transparent),
      transparent
    );
    transform: translateX(-140%);
    pointer-events: none;
  }

  .unlock-bubble-animated .unlock-shine {
    animation: unlock-sweep 900ms ease-out 260ms;
  }

  @keyframes unlock-sweep {
    to {
      transform: translateX(320%);
    }
  }

  .unlock-bubble-animated .unlock-medal {
    animation: unlock-medal 620ms cubic-bezier(0.2, 1.5, 0.4, 1) 100ms backwards;
  }

  @keyframes unlock-medal {
    from {
      transform: scale(0.4) rotate(-18deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotate(0);
      opacity: 1;
    }
  }

  /* The reward lands after the name has been read, so it registers as the
     consequence rather than as one more line of the same block. */
  .unlock-bubble-animated .unlock-reward {
    animation: unlock-reward 420ms ease-out 520ms backwards;
  }

  @keyframes unlock-reward {
    from {
      transform: translateY(6px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
