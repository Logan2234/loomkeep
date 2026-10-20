<script lang="ts">
  // One bell or history entry. Desktop: a "…" menu on hover. Compact shell:
  // swipe right to mark it read (or unread again), left to delete it.
  import { isDomainEnabled, pathDomain } from "#lib/domain-availability.js";
  import { formatRelative } from "#lib/format.js";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import {
    cascade,
    CASCADE_STEP_MS,
  } from "#lib/notifications/actions.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { NotificationDto } from "@loomkeep/shared";
  import Avatar from "../Avatar.svelte";
  import DomainOffMark from "../DomainOffMark.svelte";
  import Dropdown from "../Dropdown.svelte";
  import Icon from "../Icon.svelte";
  import { notificationView } from "../notification-presentation";

  let {
    entry,
    index = 0,
    onread,
    onunread,
    onremove,
    onopen,
  }: {
    entry: NotificationDto;
    /** Its place in the list, for the "mark all read" cascade. */
    index?: number;
    onread: (entry: NotificationDto) => void;
    onunread: (entry: NotificationDto) => void;
    onremove: (entry: NotificationDto) => void;
    /** Following its link, e.g. so the bell closes behind. */
    onopen?: () => void;
  } = $props();

  const SWIPE_THRESHOLD = 72;

  const view = $derived(notificationView(entry));
  const unread = $derived(entry.readAt === null);
  const domain = $derived(entry.url ? pathDomain(entry.url) : null);
  const off = $derived(domain !== null && !isDomainEnabled(domain));
  const href = $derived(entry.url && !off ? entry.url : null);
  const delay = $derived(cascade.on ? `${index * CASCADE_STEP_MS}ms` : "0ms");

  let dx = $state(0);
  let dragging = $state(false);
  let leaving = $state(false);
  let start: { x: number; y: number; id: number } | null = null;
  let swiped = false;

  function open() {
    if (unread) onread(entry);
    onopen?.();
  }

  function onpointerdown(event: PointerEvent) {
    if (!layout.compact || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    swiped = false;
  }

  function onpointermove(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;

    if (!dragging) {
      // A vertical drag is the list scrolling: let it go.
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) start = null;
      if (Math.abs(x) < 8 || Math.abs(x) < Math.abs(y)) return;
      dragging = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    dx = x;
  }

  function onpointerup() {
    start = null;
    if (!dragging) return;
    dragging = false;
    swiped = true;

    if (dx < -SWIPE_THRESHOLD) {
      leaving = true;
      setTimeout(() => onremove(entry), prefersReducedMotion() ? 0 : 160);
      return;
    }
    if (dx > SWIPE_THRESHOLD) (unread ? onread : onunread)(entry);
    dx = 0;
  }

  // The click that ends a swipe isn't a tap on the entry.
  function onclickcapture(event: MouseEvent) {
    if (!swiped) return;
    swiped = false;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<div class="group relative">
  {#if layout.compact}
    <div
      class="absolute inset-0 flex text-xs font-bold {dx === 0
        ? 'opacity-0'
        : ''}"
      aria-hidden="true">
      {#if dx > 0}
        <span
          class="bg-accent text-accent-fg flex flex-1 items-center gap-1.5 px-5">
          <Icon
            name={unread ? "check" : "mark-unread"}
            class="h-4 w-4 transition-transform duration-150 {dx >
            SWIPE_THRESHOLD
              ? 'scale-115'
              : ''}" />
          {unread ? m.notif_swipe_read() : m.notif_swipe_unread()}
        </span>
      {:else}
        <span
          class="bg-danger flex flex-1 items-center justify-end gap-1.5 px-5 text-white">
          {m.common_delete()}
          <Icon
            name="trash"
            class="h-4 w-4 transition-transform duration-150 {dx <
            -SWIPE_THRESHOLD
              ? 'scale-115'
              : ''}" />
        </span>
      {/if}
    </div>
  {/if}

  <svelte:element
    this={href ? "a" : "div"}
    {href}
    role={href ? undefined : "group"}
    onclick={href ? open : undefined}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    {onclickcapture}
    style:transform={leaving
      ? "translateX(-105%)"
      : dx
        ? `translateX(${dx}px)`
        : undefined}
    class="row-flash relative flex touch-pan-y items-start gap-3 py-2.5 pr-11 pl-6 select-none max-md:pr-4
      {dragging
      ? ''
      : 'transition-[transform,background-color] duration-200 motion-reduce:transition-none'}
      {unread
      ? 'bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-surface))]'
      : 'bg-surface'}
      {href
      ? unread
        ? 'hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))]'
        : 'hover:bg-surface-2'
      : ''}">
    <span
      class="bg-accent absolute top-6 left-2.5 h-1.5 w-1.5 rounded-full transition-[opacity,scale] duration-200 {unread
        ? 'ease-out'
        : 'scale-95 opacity-0 ease-in'}"
      style:transition-delay={delay}
      aria-hidden="true"></span>

    {#if view.actor}
      <span class="relative shrink-0">
        <Avatar seed={view.actor.username} size={36} />
        <span
          class="bg-surface border-border text-accent absolute -right-1 -bottom-1 grid h-[1.1rem] w-[1.1rem] place-items-center rounded-full border">
          <Icon name={view.icon} class="h-2.5 w-2.5" />
        </span>
      </span>
    {:else}
      <span
        class="grid h-9 w-9 shrink-0 place-items-center rounded-xl {view.tone ===
        'warning'
          ? 'bg-warning/15 text-warning'
          : view.tone === 'plain'
            ? 'bg-surface-2 text-dim'
            : 'bg-accent/15 text-accent'}">
        <Icon name={view.icon} class="h-[1.1rem] w-[1.1rem]" />
      </span>
    {/if}

    <span class="min-w-0 flex-1">
      <span
        class="block text-sm leading-snug transition-colors duration-200 {unread
          ? 'text-fg'
          : 'text-fg/80'}">
        {#if view.actor}
          <span class="font-bold">{view.actor.name}</span>
          {view.text}
        {:else}
          <span class="font-semibold">{view.text}</span>
        {/if}
        {#if unread}<span class="sr-only">· {m.notif_unread()}</span>{/if}
      </span>
      {#if view.body}
        <span class="text-dim mt-0.5 line-clamp-2 block text-[0.82rem]">
          {view.body}
        </span>
      {/if}
    </span>

    <span class="timecode shrink-0 pt-0.5 text-[0.68rem] whitespace-nowrap">
      {formatRelative(entry.createdAt)}
    </span>
    {#if domain && off}
      <DomainOffMark {domain} class="-my-1.5 shrink-0" />
    {/if}
  </svelte:element>

  {#if !layout.compact}
    <!-- No transform nor opacity on the menu's ancestors: a transform would
         hold its fixed panel inside the row, an opacity below 1 under the
         rows that follow. -->
    <div class="absolute inset-y-0 right-2 flex items-center">
      <Dropdown placement="bottom-end" class="min-w-52">
        {#snippet trigger({ open: menuOpen, toggle, onkeydown })}
          <button
            type="button"
            class="text-dim hover:text-fg hover:bg-surface-2 grid h-8 w-8 place-items-center rounded-lg opacity-0 transition-[opacity,color,background-color] duration-150 group-focus-within:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
            aria-label={m.common_more_actions()}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            {onkeydown}
            onclick={toggle}>
            <Icon name="dots-horizontal" class="h-4 w-4" />
          </button>
        {/snippet}
        {#snippet children({ close })}
          <button
            role="menuitem"
            class="menu-item"
            onclick={() => {
              close();
              (unread ? onread : onunread)(entry);
            }}>
            <Icon name={unread ? "check" : "mark-unread"} class="h-4 w-4" />
            {unread ? m.notif_mark_read() : m.notif_mark_unread()}
          </button>
          <button
            role="menuitem"
            class="menu-item menu-item-danger"
            onclick={() => {
              close();
              onremove(entry);
            }}>
            <Icon name="trash" class="h-4 w-4" />
            {m.common_delete()}
          </button>
        {/snippet}
      </Dropdown>
    </div>
  {/if}
</div>
