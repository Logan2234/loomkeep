<script lang="ts">
  import { page } from "$app/state";
  import { portal } from "$lib/actions/portal";
  import { scrollLock } from "$lib/actions/scrollLock";
  import { getCommentCount } from "$lib/api/client";
  import { m } from "$lib/paraglide/messages.js";
  import type { CommentTargetType } from "@loomkeep/shared";
  import { createQuery } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import CommentThread from "./CommentThread.svelte";
  import Icon from "./Icon.svelte";

  let {
    targetType,
    targetId,
    title,
    canParticipate = false,
  }: {
    targetType: CommentTargetType;
    targetId: string;
    title: string;
    canParticipate?: boolean;
  } = $props();

  let open = $state(false);
  const focusCommentId = $derived(page.url.searchParams.get("comment"));
  const count = createQuery(() => ({
    queryKey: ["comment-count", targetType, targetId],
    queryFn: () => getCommentCount(targetType, targetId),
  }));

  onMount(() => {
    const requestedTarget = page.url.searchParams.get("commentTarget");
    open = requestedTarget === `${targetType}:${targetId}`;
  });
</script>

<button
  type="button"
  class="border-border hover:border-accent/60 hover:bg-surface-2 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={() => (open = true)}>
  <Icon name="message" class="h-4 w-4" />
  {m.common_comments()}
  <span class="text-dim tabular-nums">{count.data?.count ?? 0}</span>
</button>

{#if open}
  <div use:portal use:scrollLock class="contents">
    <button
      class="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm"
      aria-label={m.common_close()}
      onclick={() => (open = false)}></button>
    <aside
      role="dialog"
      aria-modal="true"
      aria-label={m.media_comments_title({ target: title })}
      class="bg-bg border-border fixed inset-y-0 right-0 z-70 flex w-full max-w-xl flex-col border-l shadow-2xl">
      <header
        class="border-border flex shrink-0 items-center gap-3 border-b px-5 py-4">
        <div class="min-w-0 flex-1">
          <p class="timecode text-[0.65rem] tracking-[0.18em] uppercase">
            {m.common_comments()}
          </p>
          <h2 class="font-display truncate text-lg font-bold">{title}</h2>
        </div>
        <button
          class="btn-icon"
          aria-label={m.common_close()}
          onclick={() => (open = false)}>
          <Icon name="x" class="h-5 w-5" />
        </button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <CommentThread
          {targetType}
          {targetId}
          {canParticipate}
          {focusCommentId} />
      </div>
    </aside>
  </div>
{/if}
