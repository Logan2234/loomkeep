<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    MessageWorkDto,
    PickDomain,
    PickReelWorkDto,
  } from "@loomkeep/shared";
  import { fly, scale } from "svelte/transition";

  let {
    domain,
    shared,
    work,
    reel,
    rolling = $bindable(false),
    mine,
    sharedCount,
    drawing,
    onscope,
    onreroll,
    onremove,
  }: {
    domain: PickDomain;
    shared: boolean;
    /** Null while drawing, or with nothing to draw from. */
    work: MessageWorkDto | null;
    /** Other works of the pile, rolled through before `work` shows. */
    reel: PickReelWorkDto[];
    /** True while the reel turns, before `work` shows. */
    rolling?: boolean;
    mine: number;
    sharedCount: number;
    drawing: boolean;
    onscope: (shared: boolean) => void;
    onreroll: () => void;
    onremove: () => void;
  } = $props();

  const reduced = prefersReducedMotion();

  // Fast at first, then slower and slower: about two seconds in all.
  const DELAYS = Array.from({ length: 16 }, (_, i) =>
    Math.round(40 * 1.14 ** i),
  );

  let shown = $state<PickReelWorkDto | null>(null);
  let frame = $state(0);
  // Each work slides in for as long as it stays.
  const slide = $derived({
    y: -10,
    duration: reduced ? 0 : DELAYS[Math.min(frame, DELAYS.length - 1)],
  });

  $effect(() => {
    const drawn = work;
    if (!drawn || reel.length === 0 || reduced) {
      shown = drawn;
      rolling = false;
      return;
    }

    // The drawn work closes the cycle, so the reel lands on it as it turns.
    const cycle = [...reel, drawn];
    const offset =
      (cycle.length - 1 - (DELAYS.length % cycle.length)) % cycle.length;
    for (const { imageUrl } of reel) if (imageUrl) new Image().src = imageUrl;

    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    rolling = true;
    const turn = () => {
      shown = cycle[(step + offset) % cycle.length];
      frame = step;
      if (step === DELAYS.length) {
        rolling = false;
        return;
      }
      timer = setTimeout(turn, DELAYS[step++]);
    };
    turn();
    return () => clearTimeout(timer);
  });
</script>

<!-- The draw, before it's sent: where it's drawn from, and another go. -->
<div
  transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
  class="border-accent bg-accent/10 mb-2 flex items-center gap-2.5 rounded-xl border px-2 py-1.5 text-sm"
  style="transform-origin: bottom left;">
  {#key frame}
    <span
      in:fly={slide}
      class="w-7 shrink-0 overflow-hidden rounded-sm {drawing
        ? 'animate-pulse'
        : ''}">
      <Poster
        src={shown?.imageUrl ?? null}
        title={shown?.title ?? DOMAINS[domain].label}
        alt=""
        caption={false} />
    </span>
  {/key}
  <span class="min-w-0 flex-1">
    <span class="block overflow-hidden" aria-live={rolling ? "off" : "polite"}>
      {#key frame}
        <b
          in:fly={slide}
          class="block truncate font-semibold {rolling ? 'text-dim' : ''}">
          {drawing
            ? m.chat_pick_drawing()
            : (shown?.title ?? m.chat_pick_nothing())}
        </b>
      {/key}
    </span>
    <span
      class="bg-surface-2 mt-1 inline-flex max-w-full gap-0.5 rounded-full p-0.5"
      role="group"
      aria-label={m.chat_pick_scope()}>
      <button
        type="button"
        class="rounded-full px-2 py-0.5 text-[0.7rem] font-bold whitespace-nowrap transition-colors duration-150
          {shared ? 'text-dim' : 'bg-surface text-fg shadow-sm'}"
        aria-pressed={!shared}
        disabled={rolling}
        onclick={() => onscope(false)}>
        {m.chat_pick_scope_mine({ count: mine })}
      </button>
      <button
        type="button"
        class="rounded-full px-2 py-0.5 text-[0.7rem] font-bold whitespace-nowrap transition-colors duration-150 disabled:opacity-45
          {shared ? 'bg-surface text-fg shadow-sm' : 'text-dim'}"
        aria-pressed={shared}
        disabled={rolling || sharedCount === 0}
        onclick={() => onscope(true)}>
        {m.chat_pick_scope_shared({ count: sharedCount })}
      </button>
    </span>
  </span>
  <button
    type="button"
    class="border-border bg-surface hover:border-accent hover:text-accent shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors duration-150 disabled:opacity-45"
    disabled={drawing || rolling || !work}
    onclick={onreroll}>
    {m.chat_pick_reroll()}
  </button>
  <button
    type="button"
    class="btn-icon h-7 w-7"
    aria-label={m.chat_pick_remove()}
    onclick={onremove}>
    <Icon name="x" class="h-3.5 w-3.5" />
  </button>
</div>
