<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import TrackingStatusBadge from "$lib/components/TrackingStatusBadge.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { SagaMemberView } from "$lib/saga";
  import { toast } from "$lib/toast.svelte";
  import { cubicOut } from "svelte/easing";
  import { fly, scale, slide } from "svelte/transition";

  // The saga on a work's page, whatever its domain: a reel of segments, then
  // the works around the one on screen. Each domain wraps it with its own
  // query, statuses and "add" action.
  let {
    title,
    members,
    currentId,
    currentSeen,
    adding,
    onAdd,
    addButton,
    addLabel,
    isNew = false,
  }: {
    title: string;
    members: SagaMemberView[];
    currentId: string;
    /** The work on screen is finished: the moment its sequel is offered. */
    currentSeen: boolean;
    adding: boolean;
    onAdd: (member: SagaMemberView) => void;
    /** The add button's text: the domain's to-do status. */
    addButton: string;
    addLabel: (title: string) => string;
    isNew?: boolean;
  } = $props();

  const reduced = prefersReducedMotion();
  const ms = (duration: number) => (reduced ? 0 : duration);

  const current = $derived(members.findIndex((x) => x.id === currentId));
  // An announcement counts for nothing yet.
  const released = $derived(members.filter((x) => !x.upcoming));
  const seenCount = $derived(released.filter((x) => x.seen).length);

  // Folded, the list keeps the current work and two on either side; what's
  // cut before and after unfolds as two blocks rather than row by row.
  let expanded = $state(false);
  const windowStart = $derived(Math.max(0, current - 2));
  const windowEnd = $derived(Math.max(current, 2) + 3);
  const before = $derived(members.slice(0, windowStart));
  const around = $derived(members.slice(windowStart, windowEnd));
  const after = $derived(members.slice(windowEnd));
  const foldable = $derived(before.length + after.length > 0);

  // The end segments pin their label to their own edge so it never spills
  // out of the card.
  const tooltipAnchor = (i: number) =>
    i === 0
      ? "left-0"
      : i === members.length - 1
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  const numberOf = (x: SagaMemberView) =>
    String(x.position ?? members.indexOf(x) + 1).padStart(2, "0");

  // Finishing a work is the moment its sequel is most wanted: offer it then,
  // rather than leaving it to be searched for.
  let previousSeen: boolean | undefined;
  $effect(() => {
    const seen = currentSeen;
    const before = previousSeen;
    previousSeen = seen;
    if (before === undefined || before || !seen) return;

    const next = members.find((x, i) => i > current && !x.seen);
    if (!next) return;
    const open = {
      label: m.media_saga_next_open(),
      onSelect: () => void goto(next.href),
    };
    toast.action(
      m.media_saga_next_toast({ title: next.title }),
      next.badge
        ? [open]
        : [
            {
              label: m.media_saga_next_add(),
              onSelect: () => onAdd(next),
            },
            open,
          ],
      "success",
    );
  });
</script>

{#snippet row(member: SagaMemberView)}
  {@const here = member.id === currentId}
  <div
    role="listitem"
    class="relative grid grid-cols-[1.75rem_2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors {here
      ? 'bg-accent/10'
      : 'hover:bg-surface-2/70'}">
    <span
      class="font-mono text-xs tabular-nums {here
        ? 'text-accent'
        : 'text-dim'}">
      {numberOf(member)}
    </span>
    <div class={member.upcoming ? "opacity-50" : ""}>
      <Poster
        src={member.posterUrl}
        title={member.title}
        alt=""
        caption={false} />
    </div>
    <div class="min-w-0">
      <p class="truncate font-semibold">
        {#if here}
          {member.title}
          <span
            class="border-accent/45 bg-accent/10 text-accent ml-1 rounded-full border px-1.5 align-middle text-[0.6rem] font-bold tracking-wider uppercase">
            {m.media_saga_here()}
          </span>
        {:else}
          <!-- Stretched over the whole row, so the row is the link. -->
          <a
            href={member.href}
            class="focus-visible:after:outline-accent after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2">
            {member.title}
          </a>
        {/if}
      </p>
      <p class="timecode truncate text-xs">{member.meta}</p>
    </div>
    {#key member.badge?.status}
      <div
        class="relative z-10 flex justify-end"
        in:scale={{ start: 0.7, duration: ms(220), easing: cubicOut }}>
        {#if member.badge}
          <TrackingStatusBadge {...member.badge} />
        {:else if !here}
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            aria-label={addLabel(member.title)}
            disabled={adding}
            onclick={() => onAdd(member)}>
            <Icon name="plus" class="h-3.5 w-3.5" />
            {addButton}
          </button>
        {:else if member.upcoming}
          <span
            class="border-border text-dim inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-bold">
            <Icon name="calendar" class="h-3.5 w-3.5" />
            {m.media_saga_upcoming()}
          </span>
        {/if}
      </div>
    {/key}
  </div>
{/snippet}

{#if members.length > 1}
  <section
    class="card mt-10 flex flex-col gap-4 p-4 sm:p-5"
    in:fly={{ y: 12, duration: ms(280), easing: cubicOut }}>
    <div class="flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="timecode flex items-center gap-2 text-xs">
          {m.media_saga_title()}
          {#if isNew}<NewBadge />{/if}
        </p>
        <h2 class="font-display text-xl font-bold text-balance">
          {title}
        </h2>
      </div>
      <p class="shrink-0 text-right font-mono">
        <span class="inline-flex text-2xl font-bold tabular-nums">
          {#key seenCount}
            <span in:fly={{ y: -10, duration: ms(260), easing: cubicOut }}
              >{seenCount}</span>
          {/key}<span class="text-dim">/{released.length}</span>
        </span>
        <span class="timecode block text-xs">{m.media_saga_done()}</span>
      </p>
    </div>

    <!-- The reel: one segment per work, coloured by its status. The work on
         screen gets the playhead above its segment. -->
    <div class="flex gap-0.5 pt-2.5">
      {#each members as member, i (member.id)}
        {@const here = member.id === currentId}
        {@const label = `${numberOf(member)} · ${member.title}`}
        <svelte:element
          this={here ? "span" : "a"}
          href={here ? undefined : member.href}
          aria-label={here ? undefined : label}
          aria-current={here ? "true" : undefined}
          data-saga-segment
          class="saga-segment group relative flex h-4 flex-1 items-center"
          style:animation-delay="{reduced ? 0 : i * 45}ms">
          {#if here}
            <span
              class="border-t-fg absolute -top-2.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent"
              aria-hidden="true"></span>
          {/if}
          <span
            class="block h-2 w-full rounded-sm transition-[height,filter,transform] duration-200 ease-out {member.segmentClass} {here
              ? 'h-3'
              : 'group-hover:h-3.5 group-hover:brightness-125 group-focus-visible:h-3.5 group-active:scale-y-75'}"
          ></span>
          {#if !here}
            <span
              class="bg-fg text-bg pointer-events-none absolute bottom-full z-20 mb-2 {tooltipAnchor(
                i,
              )} translate-y-1 rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              aria-hidden="true">
              {label}
            </span>
          {/if}
        </svelte:element>
      {/each}
    </div>

    <div role="list" class="flex flex-col">
      {#if expanded && before.length > 0}
        <div
          class="flex flex-col"
          transition:slide={{ duration: ms(260), easing: cubicOut }}>
          {#each before as member (member.id)}
            {@render row(member)}
          {/each}
        </div>
      {/if}
      {#each around as member (member.id)}
        {@render row(member)}
      {/each}
      {#if expanded && after.length > 0}
        <div
          class="flex flex-col"
          transition:slide={{ duration: ms(260), easing: cubicOut }}>
          {#each after as member (member.id)}
            {@render row(member)}
          {/each}
        </div>
      {/if}
    </div>

    {#if foldable}
      <button
        type="button"
        class="btn-text self-start text-sm"
        aria-expanded={expanded}
        onclick={() => (expanded = !expanded)}>
        {expanded
          ? m.common_see_less()
          : m.media_saga_show_all({ count: members.length })}
        <Icon
          name="chevron-down"
          class="h-4 w-4 transition-transform duration-200 {expanded
            ? 'rotate-180'
            : ''}" />
      </button>
    {/if}
  </section>
{/if}

<style>
  /* Each segment fills in turn as the block arrives, like a reel being laid out. */
  .saga-segment {
    transform-origin: left;
    animation: saga-segment-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  @keyframes saga-segment-in {
    from {
      transform: scaleX(0);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .saga-segment {
      animation: none;
    }
  }

  :global(.a11y-reduce-motion) .saga-segment {
    animation: none;
  }
</style>
