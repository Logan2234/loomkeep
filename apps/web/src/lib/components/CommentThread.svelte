<script lang="ts">
  import { longpress } from "$lib/actions/longpress";
  import {
    createComment,
    deleteComment,
    getCommentReplies,
    getComments,
    reactToComment,
    reportComment,
    unreactToComment,
    updateComment,
  } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { auth } from "$lib/auth.svelte";
  import FocusOverlay from "$lib/components/FocusOverlay.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { onRealtimeEvent } from "$lib/realtime/socket";
  import { toast } from "$lib/toast.svelte";
  import {
    COMMENT_EMOTE_DISPLAY,
    COMMENT_TEXT_MAX_LENGTH,
    type CommentDto,
    type CommentEmote,
    type CommentMentionDto,
    type CommentTargetType,
    type PagedResult,
    type ReportCategory,
    type ReportMotif,
  } from "@loomkeep/shared";
  import {
    createInfiniteQuery,
    createMutation,
    useQueryClient,
    type InfiniteData,
  } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import Avatar from "./Avatar.svelte";
  import CommentMentionInput from "./CommentMentionInput.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import LevelBadge from "./LevelBadge.svelte";
  import ReportModal from "./ReportModal.svelte";

  let {
    targetType,
    targetId,
    canParticipate = false,
    focusCommentId = null,
    showSpoilers = false,
  }: {
    targetType: CommentTargetType;
    targetId: string;
    /** Reading is public; writing, replying and reacting require tracking. */
    canParticipate?: boolean;
    /** The comment addressed by a notification link, when already in the page. */
    focusCommentId?: string | null;
    showSpoilers?: boolean;
  } = $props();

  const queryClient = useQueryClient();
  const reduced = prefersReducedMotion();
  const key = $derived(["comments", targetType, targetId] as const);
  const countKey = $derived(["comment-count", targetType, targetId] as const);

  const expanded = true;
  let feed = $state<HTMLDivElement | null>(null);

  const query = createInfiniteQuery<
    PagedResult<CommentDto>,
    Error,
    InfiniteData<PagedResult<CommentDto>>,
    typeof key,
    number
  >(() => ({
    queryKey: key,
    queryFn: ({ pageParam }) => getComments(targetType, targetId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
    enabled: expanded,
  }));

  // Pushed live by EventsGateway (see CommentService's create/update/remove/
  // react/unreact) instead of the 5s poll this used to run while open.
  $effect(() => {
    const off = onRealtimeEvent<{
      targetType: string;
      targetId: string;
    }>("comment-changed", (event) => {
      if (event.targetType !== targetType || event.targetId !== targetId) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: countKey });
    });
    return () => {
      off();
    };
  });

  const comments = $derived(query.data?.pages.flatMap((p) => p.items) ?? []);

  $effect(() => {
    if (!focusCommentId || !query.data) return;
    void tick().then(() => {
      document.getElementById(`comment-${focusCommentId}`)?.scrollIntoView({
        block: "center",
      });
    });
  });
  // A deleted top-level comment only earns its tombstone when it still has
  // replies to keep attached; with none, there's nothing left to preserve so
  // it's simply dropped. A deleted reply never has children of its own, so
  // it's always dropped — no tombstone case applies to it. Read from
  // replyCount, not the embedded preview, which is only the thread's tail.
  const visibleComments = $derived(
    comments
      .filter((c) => !(c.deleted && c.replyCount === 0))
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );

  const displayedComments = $derived(visibleComments);
  let latestCommentId: string | null = null;
  let showJumpToLatest = $state(false);
  let shouldPinToLatest = false;

  $effect(() => {
    const latest = visibleComments.at(-1)?.id;
    if (!feed || !latest || focusCommentId) return;

    const distanceFromBottom =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    if (
      shouldPinToLatest ||
      latestCommentId === null ||
      distanceFromBottom < 80
    ) {
      void tick().then(() => {
        if (feed) {
          feed.scrollTop = feed.scrollHeight;
          showJumpToLatest = false;
          shouldPinToLatest = false;
        }
      });
    }
    latestCommentId = latest;
  });

  // Replies beyond the preview each list page embeds: fetched on demand from
  // /comments/{id}/replies, newest page first, accumulated per comment.
  let loadedReplies = $state<Map<string, CommentDto[]>>(new Map());
  let nextReplyPage = $state<Map<string, number>>(new Map());
  let loadingReplies = $state<Set<string>>(new Set());

  /**
   * What to render under a comment: the embedded preview until "earlier
   * replies" is used, then the accumulated pages — with the latest preview
   * merged back in on every poll, so a reply posted meanwhile shows up
   * without collapsing the thread.
   */
  function repliesOf(c: CommentDto): CommentDto[] {
    const loaded = loadedReplies.get(c.id);
    if (!loaded) return c.replies;

    const byId = new Map([...loaded, ...c.replies].map((r) => [r.id, r]));
    return [...byId.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  async function expandReplies(id: string) {
    if (loadingReplies.has(id)) return;
    loadingReplies = new Set(loadingReplies).add(id);

    try {
      const page = nextReplyPage.get(id) ?? 1;
      const result = await getCommentReplies(id, page);
      const merged = [...(loadedReplies.get(id) ?? []), ...result.items];
      loadedReplies = new Map(loadedReplies).set(id, merged);
      nextReplyPage = new Map(nextReplyPage).set(id, page + 1);
    } catch (err) {
      toast.error(resolveApiError(err));
    } finally {
      const next = new Set(loadingReplies);
      next.delete(id);
      loadingReplies = next;
    }
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: countKey });
  }

  async function loadOlder(): Promise<void> {
    if (!query.hasNextPage || query.isFetchingNextPage) return;

    const scrollTop = feed?.scrollTop ?? 0;
    const scrollHeight = feed?.scrollHeight ?? 0;
    await query.fetchNextPage();
    await tick();

    if (feed) {
      feed.scrollTop = scrollTop + feed.scrollHeight - scrollHeight;
      updateJumpToLatest();
    }
  }

  function loadOlderWhenVisible(
    node: HTMLElement,
    root: HTMLDivElement | null,
  ) {
    let observer: IntersectionObserver | undefined;

    function observe(scrollRoot: HTMLDivElement | null) {
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) void loadOlder();
        },
        { root: scrollRoot, rootMargin: "160px 0px 0px" },
      );
      observer.observe(node);
    }

    observe(root);
    return {
      update: observe,
      destroy: () => observer?.disconnect(),
    };
  }

  function updateJumpToLatest() {
    if (!feed) return;
    showJumpToLatest =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight > 160;
  }

  function scrollToBottom() {
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    showJumpToLatest = false;
  }

  const createMut = createMutation(() => ({
    mutationFn: createComment,
    onSuccess: invalidate,
  }));
  const updateMut = createMutation(() => ({
    mutationFn: (vars: {
      id: string;
      text: string;
      spoilerTag?: boolean;
      mentions?: { userId: string; start: number }[];
    }) =>
      updateComment(vars.id, {
        text: vars.text,
        spoilerTag: vars.spoilerTag,
        mentions: vars.mentions,
      }),
    onSuccess: invalidate,
  }));
  const deleteMut = createMutation(() => ({
    mutationFn: deleteComment,
    onSuccess: invalidate,
  }));
  const reactMut = createMutation(() => ({
    mutationFn: (vars: { id: string; emote: CommentEmote }) =>
      reactToComment(vars.id, vars.emote),
    onSuccess: invalidate,
  }));
  const unreactMut = createMutation(() => ({
    mutationFn: unreactToComment,
    onSuccess: invalidate,
  }));

  let newText = $state("");
  let newMentions = $state<CommentMentionDto[]>([]);
  let newSpoilerTag = $state(false);
  let replyToId = $state<string | null>(null);
  let replyText = $state("");
  let replyMentions = $state<CommentMentionDto[]>([]);
  let replySpoilerTag = $state(false);
  let editingId = $state<string | null>(null);
  let editText = $state("");
  let editMentions = $state<CommentMentionDto[]>([]);
  let editSpoilerTag = $state(false);
  let reactingId = $state<string | null>(null);
  let revealed = $state<Set<string>>(new Set());
  let confirmDeleteId = $state<string | null>(null);
  let reportingId = $state<string | null>(null);

  // Long-press focus (touch): centers the pressed comment in a focused
  // reading mode without making the full panel difficult to scan.
  let focusedId = $state<string | null>(null);
  const focused = $derived.by(() => {
    if (!focusedId) return null;
    for (const c of visibleComments) {
      if (c.id === focusedId) return { comment: c, isReply: false };
      const reply = repliesOf(c).find((r) => r.id === focusedId);
      if (reply) return { comment: reply, isReply: true };
    }
    return null;
  });

  const allowSpoilerTag = $derived(targetType !== "MUSIC");

  // Anti-flood cooldown (mirrors the backend's 1-per-5s throttle on POST
  // /comments) — shared between the top-level composer and replies, since
  // it's the same rate-limited endpoint. Client-only, self-paced; lost on
  // reload is an accepted edge case.
  let cooldownUntil = $state(0);
  let cooldownRemaining = $state(0);

  function tickCooldown() {
    const remaining = Math.max(
      0,
      Math.ceil((cooldownUntil - Date.now()) / 1000),
    );
    cooldownRemaining = remaining;
    if (remaining > 0) setTimeout(tickCooldown, 250);
  }

  function startCooldown() {
    cooldownUntil = Date.now() + 5000;
    tickCooldown();
  }

  function reveal(id: string) {
    revealed = new Set(revealed).add(id);
  }

  function mentionParts(
    comment: CommentDto,
  ): { text: string; start: number; username?: string }[] {
    const text = comment.text ?? "";
    if (comment.mentions.length === 0) return [{ text, start: 0 }];

    const parts: { text: string; start: number; username?: string }[] = [];
    let cursor = 0;

    for (const mention of comment.mentions.toSorted(
      (a, b) => a.start - b.start,
    )) {
      const token = `@${mention.username}`;
      if (
        mention.start < cursor ||
        text.slice(mention.start, mention.start + token.length) !== token
      ) {
        continue;
      }
      if (mention.start > cursor) {
        parts.push({ text: text.slice(cursor, mention.start), start: cursor });
      }
      parts.push({
        text: token,
        start: mention.start,
        username: mention.username,
      });
      cursor = mention.start + token.length;
    }
    if (cursor < text.length)
      parts.push({ text: text.slice(cursor), start: cursor });
    return parts.length > 0 ? parts : [{ text, start: 0 }];
  }

  function expand(node: Element) {
    const style = getComputedStyle(node);
    const height = parseFloat(style.height);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const marginTop = parseFloat(style.marginTop);
    const borderTop = parseFloat(style.borderTopWidth);
    const borderBottom = parseFloat(style.borderBottomWidth);

    return {
      duration: reduced ? 0 : 180,
      css: (t: number) =>
        `overflow: hidden; height: ${t * height}px; margin-top: ${t * marginTop}px; padding-top: ${t * paddingTop}px; padding-bottom: ${t * paddingBottom}px; border-top-width: ${t * borderTop}px; border-bottom-width: ${t * borderBottom}px;`,
    };
  }

  async function submitTop() {
    const text = newText.trim();
    if (!text || cooldownRemaining > 0) return;
    try {
      await createMut.mutateAsync({
        targetType,
        targetId,
        text,
        spoilerTag: allowSpoilerTag ? newSpoilerTag : undefined,
        mentions: newMentions.map(({ id, start }) => ({ userId: id, start })),
      });
      newText = "";
      newMentions = [];
      newSpoilerTag = false;
      startCooldown();
      shouldPinToLatest = true;
      void tick().then(scrollToBottom);
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  async function submitReply(parentId: string) {
    const text = replyText.trim();
    if (!text || cooldownRemaining > 0) return;
    try {
      await createMut.mutateAsync({
        targetType,
        targetId,
        parentId,
        text,
        spoilerTag: allowSpoilerTag ? replySpoilerTag : undefined,
        mentions: replyMentions.map(({ id, start }) => ({ userId: id, start })),
      });
      replyText = "";
      replyMentions = [];
      replySpoilerTag = false;
      replyToId = null;
      startCooldown();
      shouldPinToLatest = true;
      void tick().then(scrollToBottom);
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  function startEdit(c: CommentDto) {
    replyToId = null;
    replyText = "";
    replyMentions = [];
    editingId = c.id;
    editText = c.text ?? "";
    editMentions = c.mentions;
    editSpoilerTag = c.spoilerTag;
  }

  function cancelEdit() {
    editingId = null;
    editText = "";
    editMentions = [];
  }

  function startReply(id: string) {
    if (replyToId === id) {
      replyToId = null;
      replyText = "";
      replyMentions = [];
      return;
    }
    editingId = null;
    replyToId = id;
    replyText = "";
    replyMentions = [];
    replySpoilerTag = false;
  }

  function cancelReply() {
    replyToId = null;
    replyText = "";
    replyMentions = [];
  }

  async function submitEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    try {
      await updateMut.mutateAsync({
        id,
        text,
        spoilerTag: allowSpoilerTag ? editSpoilerTag : undefined,
        mentions: editMentions.map(({ id, start }) => ({ userId: id, start })),
      });
      editingId = null;
      editMentions = [];
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  async function confirmRemove() {
    if (!confirmDeleteId) return;
    try {
      await deleteMut.mutateAsync(confirmDeleteId);
      confirmDeleteId = null;
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  async function react(id: string, emote: CommentEmote) {
    reactingId = null;
    try {
      await reactMut.mutateAsync({ id, emote });
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  async function unreact(id: string) {
    try {
      await unreactMut.mutateAsync(id);
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  function openReport(id: string) {
    reportingId = id;
  }

  async function submitReport(report: {
    category: ReportCategory;
    motif?: ReportMotif;
    reason?: string;
  }) {
    if (!reportingId) return;
    try {
      await reportComment(
        reportingId,
        report.category,
        report.motif,
        report.reason,
      );
      toast.success(m.comment_reported());
    } catch {
      toast.error(m.comment_report_failed());
    } finally {
      reportingId = null;
    }
  }
</script>

{#snippet actionRow(
  c: CommentDto,
  isReply: boolean,
  forceShow: boolean = false,
)}
  <div class="relative mt-1 flex flex-wrap items-center gap-1">
    {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
      {@const count = c.reactions.find((r) => r.emote === emote)?.count ?? 0}
      {#if count > 0 || c.myReaction === emote}
        <button
          class="rounded-full px-2 py-0.5 text-xs transition-[transform,background-color,color,box-shadow] hover:-translate-y-px hover:scale-[1.035] active:scale-95 {c.myReaction ===
          emote
            ? 'bg-accent/20 text-accent hover:bg-accent/30 hover:ring-accent/30 hover:ring-1'
            : 'bg-surface-2 text-dim hover:bg-surface hover:text-fg hover:shadow-sm'}"
          disabled={!canParticipate}
          onclick={() =>
            c.myReaction === emote
              ? unreact(c.id)
              : react(c.id, emote as CommentEmote)}>
          {glyph}
          {count > 0 ? count : ""}
        </button>
      {/if}
    {/each}

    <div
      class="absolute -top-1 right-0 flex items-center gap-1 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 {forceShow ||
      reactingId === c.id
        ? 'pointer-events-auto opacity-100'
        : 'pointer-events-none opacity-0'}">
      {#if canParticipate}
        <div class="relative">
          <button
            class="text-dim hover:text-fg hover:bg-surface-2 grid h-6 w-6 place-items-center rounded-full transition-colors active:scale-95"
            title={m.common_react()}
            aria-label={m.common_react()}
            aria-expanded={reactingId === c.id}
            onclick={() => (reactingId = reactingId === c.id ? null : c.id)}>
            <Icon name="plus" class="h-3.5 w-3.5" />
          </button>
          {#if reactingId === c.id}
            <div
              class="bg-surface border-border absolute right-0 bottom-full left-auto z-10 mb-1 flex gap-1 rounded-lg border p-1 shadow-lg">
              {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
                <button
                  class="hover:bg-surface-2 rounded px-1.5 py-1 text-base transition-transform duration-150 hover:-translate-y-0.5 hover:scale-110 active:scale-95"
                  onclick={() => react(c.id, emote as CommentEmote)}>
                  {glyph}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if !isReply && canParticipate}
        <button
          class="btn-icon h-6 w-6"
          title={m.common_reply()}
          aria-label={m.common_reply()}
          onclick={() => startReply(c.id)}>
          <Icon name="reply" class="h-4 w-4" />
        </button>
      {/if}
      {#if c.author?.id === auth.user?.id}
        <button
          class="btn-icon h-6 w-6"
          title={m.common_edit()}
          aria-label={m.common_edit()}
          onclick={() => startEdit(c)}>
          <Icon name="edit" class="h-4 w-4" />
        </button>
        <button
          class="btn-icon hover:text-danger h-6 w-6"
          title={m.common_delete()}
          aria-label={m.common_delete()}
          onclick={() => (confirmDeleteId = c.id)}>
          <Icon name="trash" class="h-4 w-4" />
        </button>
      {:else}
        <button
          class="btn-icon h-6 w-6"
          title={m.common_report()}
          aria-label={m.common_report()}
          onclick={() => openReport(c.id)}>
          <Icon name="flag" class="h-4 w-4" />
        </button>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet commentCard(
  c: CommentDto,
  isReply: boolean,
  focused: boolean = false,
)}
  {@const mentioned = c.mentions.some(
    (mention) => mention.id === auth.user?.id,
  )}
  <div
    id="comment-{c.id}"
    class="group relative overflow-visible {isReply ? 'py-2.5 pl-1' : 'py-3.5'}"
    use:longpress={{
      onLongPress: () => !focused && (focusedId = c.id),
      duration: 1000,
    }}>
    {#if c.deleted}
      <p class="text-dim text-sm italic">
        {c.deletedByAdmin ? m.comment_deleted_by_admin() : m.comment_deleted()}
      </p>
    {:else}
      <div class="flex items-start gap-3">
        {#if !c.author}
          <span class="shrink-0">
            <Avatar seed="utilisateur-supprime" size={isReply ? 28 : 32} />
          </span>
        {:else if c.author.anonymized}
          <!-- Seeded on the derived pseudonym, never the real id — a stable
               seed would let the same identicon resurface across unrelated
               threads and quietly de-anonymize the author. -->
          <span class="shrink-0">
            <Avatar seed={c.author.displayName} size={isReply ? 28 : 32} />
          </span>
        {:else}
          <a href="/app/u/{c.author.username}" class="shrink-0">
            <Avatar
              seed={c.author.username}
              url={c.author.avatarUrl}
              size={isReply ? 28 : 32} />
          </a>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            {#if mentioned}
              <span
                class="bg-accent inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                aria-hidden="true"></span>
            {/if}
            {#if !c.author}
              <span class="text-dim truncate text-sm font-semibold italic">
                {m.common_deleted_user()}
              </span>
            {:else if c.author.anonymized}
              <span class="timecode truncate text-sm font-semibold">
                {c.author.displayName}
              </span>
            {:else}
              <a href="/app/u/{c.author.username}" class="btn-text text-sm">
                {c.author.displayName}
              </a>
              {#if appConfig.gamificationEnabled}
                <LevelBadge xp={c.author.xp} />
              {/if}
            {/if}
            <RelativeTime iso={c.createdAt} class="timecode text-[0.68rem]" />
            {#if c.edited}
              <span class="text-dim text-xs">{m.comment_edited_marker()}</span>
            {/if}
          </div>

          {#if editingId === c.id}
            <div
              transition:expand
              class="border-border bg-surface-2 mt-2 rounded-lg border p-2.5">
              <div class="relative">
                <CommentMentionInput
                  bind:value={editText}
                  bind:mentions={editMentions}
                  {targetType}
                  {targetId}
                  id="comment-edit-{c.id}"
                  name="commentText"
                  label={m.common_edit()}
                  inputClass="input bg-bg pr-14 text-sm"
                  onkeydown={(e) => e.key === "Enter" && submitEdit(c.id)} />
                <span
                  class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] tabular-nums">
                  {editText.length}/{COMMENT_TEXT_MAX_LENGTH}
                </span>
              </div>
              <div class="mt-2 flex items-center gap-2">
                {#if allowSpoilerTag}
                  <button
                    type="button"
                    aria-pressed={editSpoilerTag}
                    onclick={() => (editSpoilerTag = !editSpoilerTag)}
                    class="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold transition-colors {editSpoilerTag
                      ? 'bg-accent/10 text-accent'
                      : 'text-dim hover:text-fg hover:bg-bg'}">
                    <Icon name="eye-off" class="h-3.5 w-3.5" />
                    {editSpoilerTag
                      ? m.comment_unmark_spoiler()
                      : m.comment_mark_spoiler()}
                  </button>
                {/if}
                <div class="ml-auto flex items-center gap-1.5">
                  <button class="btn btn-ghost btn-sm" onclick={cancelEdit}>
                    {m.common_cancel()}
                  </button>
                  <button
                    class="btn btn-primary btn-sm"
                    onclick={() => submitEdit(c.id)}>
                    {m.common_save()}
                  </button>
                </div>
              </div>
            </div>
          {:else if c.masked && c.author?.id !== auth.user?.id && !showSpoilers && !revealed.has(c.id)}
            <button
              class="border-accent/45 bg-accent/5 text-accent hover:bg-accent/10 mt-2 inline-flex items-center gap-2 border border-dashed px-2.5 py-1.5 text-sm transition-colors"
              onclick={() => reveal(c.id)}>
              <Icon name="eye-off" class="h-3.5 w-3.5 shrink-0" />
              {m.comment_reveal_spoiler()}
            </button>
          {:else}
            <p
              class="mt-1 text-[0.95rem] leading-6 wrap-break-word whitespace-pre-wrap">
              {#each mentionParts(c) as part (part.start)}
                {#if part.username}
                  <a
                    href="/app/u/{part.username}"
                    class="text-accent hover:text-accent/80 font-semibold transition-colors"
                    >{part.text}</a>
                {:else}
                  {part.text}
                {/if}
              {/each}
            </p>
          {/if}

          {#if editingId !== c.id && replyToId !== c.id}
            {@render actionRow(c, isReply, focused)}
          {/if}

          {#if replyToId === c.id}
            <div
              transition:expand
              class="border-border bg-surface-2 mt-2 rounded-lg border p-2.5">
              <div class="relative">
                <CommentMentionInput
                  bind:value={replyText}
                  bind:mentions={replyMentions}
                  {targetType}
                  {targetId}
                  id="comment-reply-{c.id}"
                  name="replyText"
                  label={m.comment_reply_label()}
                  inputClass="input bg-bg pr-14 text-sm"
                  placeholder={!c.author
                    ? m.comment_reply_placeholder()
                    : c.author.anonymized
                      ? m.comment_reply_to({ name: c.author.displayName })
                      : m.comment_reply_to({ name: `@${c.author.username}` })}
                  onkeydown={(e) => e.key === "Enter" && submitReply(c.id)} />
                <span
                  class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] tabular-nums">
                  {replyText.length}/{COMMENT_TEXT_MAX_LENGTH}
                </span>
              </div>
              <div class="mt-2 flex items-center gap-2">
                {#if allowSpoilerTag}
                  <button
                    type="button"
                    aria-pressed={replySpoilerTag}
                    onclick={() => (replySpoilerTag = !replySpoilerTag)}
                    class="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold transition-colors {replySpoilerTag
                      ? 'bg-accent/10 text-accent'
                      : 'text-dim hover:text-fg hover:bg-bg'}">
                    <Icon name="eye-off" class="h-3.5 w-3.5" />
                    {replySpoilerTag
                      ? m.comment_unmark_spoiler()
                      : m.comment_mark_spoiler()}
                  </button>
                {/if}
                <div class="ml-auto flex items-center gap-1.5">
                  <button class="btn btn-ghost btn-sm" onclick={cancelReply}>
                    {m.common_cancel()}
                  </button>
                  <button
                    class="btn btn-primary btn-sm"
                    disabled={!replyText.trim() || cooldownRemaining > 0}
                    onclick={() => submitReply(c.id)}>
                    {cooldownRemaining > 0
                      ? m.common_wait_seconds({ seconds: cooldownRemaining })
                      : m.common_reply()}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<section class="relative flex min-h-0 flex-1 flex-col">
  <div class="relative min-h-0 flex-1">
    <div
      bind:this={feed}
      onscroll={updateJumpToLatest}
      class="h-full overflow-y-auto px-5 sm:px-6">
      <div class="py-4">
        {#if query.isPending}
          <p class="text-dim text-sm">{m.common_loading()}</p>
        {:else if query.isError}
          <div class="text-dim flex items-center justify-between gap-3 text-sm">
            <span>{m.comments_load_failed()}</span>
            <button
              class="btn btn-ghost btn-sm"
              onclick={() => query.refetch()}>
              {m.common_retry()}
            </button>
          </div>
        {:else if visibleComments.length === 0}
          <p class="text-dim text-sm">{m.comments_empty()}</p>
        {:else}
          {#if query.hasNextPage}
            <div use:loadOlderWhenVisible={feed} class="mb-2 text-center">
              <button
                class="timecode text-dim hover:text-fg text-xs"
                disabled={query.isFetchingNextPage}
                onclick={loadOlder}>
                {query.isFetchingNextPage
                  ? m.common_loading()
                  : m.common_load_more()}
              </button>
            </div>
          {/if}

          <div class="flex flex-col">
            {#each displayedComments as c (c.id)}
              {@const shownReplies = repliesOf(c)}
              {@const hiddenReplyCount = Math.max(
                0,
                c.replyCount - shownReplies.length,
              )}
              {@render commentCard(c, false)}
              {#if shownReplies.length > 0}
                <div class="border-border/70 mt-1 ml-7 border-l pl-4">
                  {#each shownReplies as r (r.id)}
                    {#if !r.deleted}
                      {@render commentCard(r, true)}
                    {/if}
                  {/each}
                </div>
              {/if}
              {#if hiddenReplyCount > 0}
                <button
                  type="button"
                  class="timecode ml-5 block text-left text-xs hover:underline disabled:opacity-50"
                  disabled={loadingReplies.has(c.id)}
                  onclick={() => expandReplies(c.id)}>
                  {hiddenReplyCount === 1
                    ? m.comments_more_replies_one({ count: hiddenReplyCount })
                    : m.comments_more_replies_many({ count: hiddenReplyCount })}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if showJumpToLatest}
      <button
        type="button"
        transition:fly={{ y: 8, duration: 160 }}
        class="border-border bg-surface text-dim hover:text-fg hover:border-accent/60 absolute right-5 bottom-4 z-10 grid h-8 w-8 place-items-center rounded-full border shadow-lg transition-all hover:-translate-y-0.5 hover:scale-105 active:scale-95 sm:right-6"
        title={m.comments_jump_to_latest()}
        aria-label={m.comments_jump_to_latest()}
        onclick={scrollToBottom}>
        <Icon name="chevron-down" class="h-3.5 w-3.5" />
      </button>
    {/if}
  </div>

  <div class="border-border bg-bg shrink-0 border-t px-5 py-4 sm:px-6">
    {#if canParticipate}
      <div
        class="comment-composer border-border bg-surface hover:border-fg/25 focus-within:border-fg/25 rounded-xl border px-3 py-2.5 transition-[border-color,background-color]">
        <div class="flex items-start gap-2.5">
          <Icon name="message" class="text-accent mt-1 h-4 w-4 shrink-0" />
          <div class="min-w-0 flex-1">
            <CommentMentionInput
              bind:value={newText}
              bind:mentions={newMentions}
              {targetType}
              {targetId}
              id="comment-add-text"
              name="commentText"
              label={m.comment_add_label()}
              inputClass="comment-composer-input placeholder:text-dim min-h-16 w-full resize-none bg-transparent text-sm leading-5 outline-none focus:outline-none focus:ring-0"
              placeholder={m.comment_add_placeholder()}
              multiline
              rows={2}
              onkeydown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitTop();
                }
              }} />
          </div>
        </div>
        <div class="border-border mt-2 flex items-center gap-2 border-t pt-2">
          {#if allowSpoilerTag}
            <button
              type="button"
              aria-pressed={newSpoilerTag}
              onclick={() => (newSpoilerTag = !newSpoilerTag)}
              class="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold transition-colors {newSpoilerTag
                ? 'text-accent bg-accent/10'
                : 'text-dim hover:text-fg hover:bg-surface-2'}">
              <Icon name="eye-off" class="h-3.5 w-3.5" />
              {newSpoilerTag
                ? m.comment_unmark_spoiler()
                : m.comment_mark_spoiler()}
            </button>
          {/if}
          <span class="timecode text-dim ml-auto text-[0.65rem] tabular-nums">
            {newText.length}/{COMMENT_TEXT_MAX_LENGTH}
          </span>
          <button
            class="btn btn-primary btn-sm h-8 px-3"
            disabled={!newText.trim() ||
              createMut.isPending ||
              cooldownRemaining > 0}
            onclick={submitTop}>
            {cooldownRemaining > 0
              ? m.common_wait_seconds({ seconds: cooldownRemaining })
              : m.common_publish()}
          </button>
        </div>
      </div>
    {:else}
      <p class="text-dim text-sm">
        {m.comments_track_to_participate()}
      </p>
    {/if}
  </div>
</section>

{#if confirmDeleteId}
  <ConfirmationModal
    title={m.comment_delete_title()}
    message={m.comment_delete_description()}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteMut.isPending}
    onConfirm={confirmRemove}
    onCancel={() => (confirmDeleteId = null)} />
{/if}

{#if focused}
  <FocusOverlay onclose={() => (focusedId = null)}>
    {#snippet content()}
      {@render commentCard(focused.comment, focused.isReply, true)}
    {/snippet}
  </FocusOverlay>
{/if}

{#if reportingId}
  <ReportModal
    title={m.comment_report_title()}
    targetType="COMMENT"
    onClose={() => (reportingId = null)}
    onSubmit={submitReport} />
{/if}

<style>
  :global(.comment-composer-input:focus-visible) {
    outline: none !important;
    outline-offset: 0;
    box-shadow: none !important;
  }
</style>
