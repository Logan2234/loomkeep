<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessageWorkDto, PickDomain } from "@loomkeep/shared";
  import { scale } from "svelte/transition";

  let {
    domain,
    shared,
    work,
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
    mine: number;
    sharedCount: number;
    drawing: boolean;
    onscope: (shared: boolean) => void;
    onreroll: () => void;
    onremove: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

<!-- The draw, before it's sent: where it's drawn from, and another go. -->
<div
  transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
  class="border-accent bg-accent/10 mb-2 flex items-center gap-2.5 rounded-xl border px-2 py-1.5 text-sm"
  style="transform-origin: bottom left;">
  <span
    class="w-7 shrink-0 overflow-hidden rounded-sm {drawing
      ? 'animate-pulse'
      : ''}">
    <Poster
      src={work?.imageUrl ?? null}
      title={work?.title ?? DOMAINS[domain].label}
      alt=""
      caption={false} />
  </span>
  <span class="min-w-0 flex-1">
    <b class="block truncate font-semibold" aria-live="polite">
      {drawing ? m.chat_pick_drawing() : (work?.title ?? m.chat_pick_nothing())}
    </b>
    <span
      class="bg-surface-2 mt-1 inline-flex max-w-full gap-0.5 rounded-full p-0.5"
      role="group"
      aria-label={m.chat_pick_scope()}>
      <button
        type="button"
        class="rounded-full px-2 py-0.5 text-[0.7rem] font-bold whitespace-nowrap transition-colors duration-150
          {shared ? 'text-dim' : 'bg-surface text-fg shadow-sm'}"
        aria-pressed={!shared}
        onclick={() => onscope(false)}>
        {m.chat_pick_scope_mine({ count: mine })}
      </button>
      <button
        type="button"
        class="rounded-full px-2 py-0.5 text-[0.7rem] font-bold whitespace-nowrap transition-colors duration-150 disabled:opacity-45
          {shared ? 'bg-surface text-fg shadow-sm' : 'text-dim'}"
        aria-pressed={shared}
        disabled={sharedCount === 0}
        onclick={() => onscope(true)}>
        {m.chat_pick_scope_shared({ count: sharedCount })}
      </button>
    </span>
  </span>
  <button
    type="button"
    class="border-border bg-surface hover:border-accent hover:text-accent shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors duration-150 disabled:opacity-45"
    disabled={drawing || !work}
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
