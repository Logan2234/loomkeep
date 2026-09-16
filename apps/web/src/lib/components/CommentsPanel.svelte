<script lang="ts">
  import { page } from "$app/state";
  import { getCommentCount } from "$lib/api/client";
  import { m } from "$lib/paraglide/messages.js";
  import { joinRealtimeRoom, onRealtimeEvent } from "$lib/realtime/socket";
  import type {
    CommentPresenceEvent,
    CommentTargetType,
  } from "@loomkeep/shared";
  import { createQuery } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import CommentThread from "./CommentThread.svelte";
  import Icon from "./Icon.svelte";
  import SidePanel from "./SidePanel.svelte";

  const PANEL_OPEN_EVENT = "loomkeep:comments-panel-open";

  let {
    targetType,
    targetId,
    title,
    canParticipate = false,
    compact = false,
    revealSpoilersByDefault = false,
  }: {
    targetType: CommentTargetType;
    targetId: string;
    title: string;
    canParticipate?: boolean;
    compact?: boolean;
    revealSpoilersByDefault?: boolean;
  } = $props();

  let open = $state(false);
  let peopleHere = $state(0);
  let showSpoilers = $state(false);
  const focusCommentId = $derived(page.url.searchParams.get("comment"));
  const peopleHereLabel = $derived(
    peopleHere === 1
      ? m.comments_person_here()
      : m.comments_people_here({ count: peopleHere }),
  );
  const count = createQuery(() => ({
    queryKey: ["comment-count", targetType, targetId],
    queryFn: () => getCommentCount(targetType, targetId),
  }));

  onMount(() => {
    const panelId = `${targetType}:${targetId}`;
    const handleOtherPanelOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== panelId) open = false;
    };
    window.addEventListener(PANEL_OPEN_EVENT, handleOtherPanelOpen);

    const requestedTarget = page.url.searchParams.get("commentTarget");
    if (requestedTarget === panelId) openPanel();

    return () => {
      window.removeEventListener(PANEL_OPEN_EVENT, handleOtherPanelOpen);
    };
  });

  $effect(() => {
    if (!open) return;
    peopleHere = 1;
    const leave = joinRealtimeRoom("join-comments", "leave-comments", {
      targetType,
      targetId,
    });
    const off = onRealtimeEvent<CommentPresenceEvent>(
      "comment-presence",
      (event) => {
        if (event.targetType === targetType && event.targetId === targetId) {
          peopleHere = event.count;
        }
      },
    );
    return () => {
      off();
      leave();
    };
  });

  function closePanel() {
    open = false;
  }

  function openPanel() {
    window.dispatchEvent(
      new CustomEvent(PANEL_OPEN_EVENT, {
        detail: `${targetType}:${targetId}`,
      }),
    );
    showSpoilers = revealSpoilersByDefault;
    open = true;
  }
</script>

{#if compact}
  <button
    type="button"
    class="text-dim hover:text-fg hover:bg-surface-2 inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-xs leading-none transition-colors active:scale-95"
    title={m.comments_discussion()}
    aria-label={m.media_comments_title({ target: title })}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={(event) => {
      event.stopPropagation();
      openPanel();
    }}>
    <Icon name="message" class="h-3.5 w-3.5" />
    <span class="timecode self-center leading-none tabular-nums"
      >{count.data?.count ?? 0}</span>
  </button>
{:else}
  <button
    type="button"
    class="text-dim hover:text-fg hover:bg-surface-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors"
    aria-label={m.media_comments_title({ target: title })}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={(event) => {
      event.stopPropagation();
      openPanel();
    }}>
    <Icon name="message" class="h-4 w-4" />
    <span class="hidden sm:inline">{m.comments_discussion()}</span>
    <span class="timecode text-dim tabular-nums">{count.data?.count ?? 0}</span>
  </button>
{/if}

{#if open}
  <SidePanel
    onclose={closePanel}
    zIndex={2147483646}
    backdropClass="bg-transparent touch-pan-y"
    labelledby="comments-panel-title">
    <header
      class="border-border flex shrink-0 items-start gap-3 border-b px-5 py-4">
      <div class="min-w-0 flex-1">
        <h2 id="comments-panel-title" class="font-display text-2xl font-bold">
          {m.comments_discussion()}
        </h2>
        <p
          class="text-accent mt-1 inline-flex items-center gap-1.5 text-[0.68rem] font-semibold">
          <span class="bg-accent h-1.5 w-1.5 rounded-full"></span>
          {peopleHereLabel}
        </p>
      </div>
      <button
        class="btn-icon"
        aria-label={m.common_close()}
        onclick={closePanel}>
        <Icon name="x" class="h-5 w-5" />
      </button>
    </header>
    <section class="border-border shrink-0 border-b px-5 py-3.5">
      <div class="flex items-center justify-between gap-3">
        <p class="timecode text-dim text-xs">{m.comments_context_open()}</p>
        <button
          type="button"
          aria-pressed={showSpoilers}
          onclick={() => (showSpoilers = !showSpoilers)}
          class="text-dim hover:text-fg hover:bg-surface-2 inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold transition-colors {showSpoilers
            ? 'bg-accent/10 text-accent'
            : ''}">
          <Icon name="eye-off" class="h-3.5 w-3.5" />
          {m.comments_show_spoilers()}
        </button>
      </div>
      <p class="mt-1 truncate text-sm font-semibold">{title}</p>
    </section>
    <CommentThread
      {targetType}
      {targetId}
      {canParticipate}
      {focusCommentId}
      {showSpoilers} />
  </SidePanel>
{/if}
