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
  import { m } from "$lib/paraglide/messages.js";
  import {
    REPORT_CATEGORY_HINTS,
    REPORT_CATEGORY_LABELS,
    REPORT_CATEGORY_ORDER,
    REPORT_MOTIF_LABELS,
  } from "../constants/report-labels";
  import { onRealtimeEvent, joinRealtimeRoom } from "$lib/realtime/socket";
  import { toast } from "$lib/toast.svelte";
  import {
    COMMENT_EMOTE_DISPLAY,
    COMMENT_TEXT_MAX_LENGTH,
    REPORT_CATEGORY_MOTIFS,
    type CommentDto,
    type CommentEmote,
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
  import { scale } from "svelte/transition";
  import Avatar from "./Avatar.svelte";
  import Combobox from "./Combobox.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import LevelBadge from "./LevelBadge.svelte";
  import Modal from "./Modal.svelte";

  let {
    targetType,
    targetId,
    canParticipate = false,
    focusCommentId = null,
  }: {
    targetType: CommentTargetType;
    targetId: string;
    /** Reading is public; writing, replying and reacting require tracking. */
    canParticipate?: boolean;
    /** The comment addressed by a notification link, when already in the page. */
    focusCommentId?: string | null;
  } = $props();

  const queryClient = useQueryClient();
  const key = $derived(["comments", targetType, targetId] as const);
  const countKey = $derived(["comment-count", targetType, targetId] as const);

  const expanded = true;

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
    if (!expanded) return;
    const leave = joinRealtimeRoom("join-comments", "leave-comments", {
      targetType,
      targetId,
    });
    const off = onRealtimeEvent("comment-changed", () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: countKey });
    });
    return () => {
      off();
      leave();
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

  const createMut = createMutation(() => ({
    mutationFn: createComment,
    onSuccess: invalidate,
  }));
  const updateMut = createMutation(() => ({
    mutationFn: (vars: { id: string; text: string; spoilerTag?: boolean }) =>
      updateComment(vars.id, { text: vars.text, spoilerTag: vars.spoilerTag }),
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
  let newSpoilerTag = $state(false);
  let replyToId = $state<string | null>(null);
  let replyText = $state("");
  let replySpoilerTag = $state(false);
  let editingId = $state<string | null>(null);
  let editText = $state("");
  let editSpoilerTag = $state(false);
  let reactingId = $state<string | null>(null);
  let revealed = $state<Set<string>>(new Set());
  let confirmDeleteId = $state<string | null>(null);
  let reportingId = $state<string | null>(null);
  let reportCategory = $state<ReportCategory | null>(null);
  let reportMotif = $state<ReportMotif | null>(null);
  let reportReason = $state("");

  const reportCategoryOptions = REPORT_CATEGORY_ORDER.map((c) => ({
    label: REPORT_CATEGORY_LABELS[c],
    value: c,
  }));
  const reportMotifOptions = $derived(
    reportCategory ? REPORT_CATEGORY_MOTIFS[reportCategory] : [],
  );
  const reportIsOther = $derived(reportCategory === "OTHER");
  const canSubmitReport = $derived(
    reportCategory !== null &&
      (reportIsOther ? reportReason.trim().length > 0 : reportMotif !== null),
  );

  // Long-press focus (touch): centers the pressed comment with a blurred
  // backdrop and reveals its actions, mirroring the desktop hover reveal.
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

  async function submitTop() {
    const text = newText.trim();
    if (!text || cooldownRemaining > 0) return;
    try {
      await createMut.mutateAsync({
        targetType,
        targetId,
        text,
        spoilerTag: allowSpoilerTag ? newSpoilerTag : undefined,
      });
      newText = "";
      newSpoilerTag = false;
      startCooldown();
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
      });
      replyText = "";
      replySpoilerTag = false;
      replyToId = null;
      startCooldown();
    } catch (err) {
      toast.error(resolveApiError(err));
    }
  }

  function startEdit(c: CommentDto) {
    editingId = c.id;
    editText = c.text ?? "";
    editSpoilerTag = c.spoilerTag;
  }

  async function submitEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    try {
      await updateMut.mutateAsync({
        id,
        text,
        spoilerTag: allowSpoilerTag ? editSpoilerTag : undefined,
      });
      editingId = null;
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
    reportCategory = null;
    reportMotif = null;
    reportReason = "";
  }

  function chooseReportCategory(category: ReportCategory) {
    reportCategory = category;
    // Skip the motif step entirely when the category only has one — nothing
    // to choose between, so pre-check it instead of showing a 1-item list.
    const motifs = REPORT_CATEGORY_MOTIFS[category];
    reportMotif = motifs.length === 1 ? motifs[0] : null;
  }

  async function submitReport() {
    if (!reportingId || !reportCategory || !canSubmitReport) return;
    try {
      await reportComment(
        reportingId,
        reportCategory,
        reportMotif ?? undefined,
        reportReason.trim() || undefined,
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
  <div class="mt-2 flex flex-wrap items-center gap-1">
    {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
      {@const count = c.reactions.find((r) => r.emote === emote)?.count ?? 0}
      {#if count > 0 || c.myReaction === emote}
        <button
          class="rounded-full px-2 py-0.5 text-xs {c.myReaction === emote
            ? 'bg-accent/20 text-accent'
            : 'bg-surface-2 text-dim hover:text-fg'}"
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

    <!-- The "+" and the action icons only make sense once you're already
         looking at this comment — hide them until hover/focus (or while the
         react popover is open) to keep the list compact. On touch, where
         there's no hover, they're reachable via the long-press focus view
         instead (see FocusOverlay below). -->
    <div
      class="ml-auto items-center gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 {forceShow ||
      reactingId === c.id
        ? 'flex opacity-100'
        : 'hidden opacity-0 md:flex'}">
      {#if canParticipate}
        <div class="relative">
          <button
            class="text-dim hover:text-fg hover:bg-surface-2 grid h-6 w-6 place-items-center rounded-full"
            title={m.common_react()}
            aria-label={m.common_react()}
            onclick={() => (reactingId = reactingId === c.id ? null : c.id)}>
            <Icon name="plus" class="h-3.5 w-3.5" />
          </button>
          {#if reactingId === c.id}
            <div
              class="bg-surface border-border absolute bottom-full left-0 z-10 mb-1 flex origin-bottom-left gap-1 rounded-lg border p-1 shadow-lg"
              transition:scale={{ duration: 140, start: 0.85 }}>
              {#each Object.entries(COMMENT_EMOTE_DISPLAY) as [emote, glyph] (emote)}
                <button
                  class="hover:bg-surface-2 rounded px-1.5 py-1 text-base"
                  onclick={() => react(c.id, emote as CommentEmote)}>
                  {glyph}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Icon-only: title/aria-label carry the meaning instead of visible
           text, to keep the row compact. -->
      <div class="text-dim flex items-center gap-0.5">
        {#if !isReply && canParticipate}
          <button
            class="btn-icon"
            title={m.common_reply()}
            aria-label={m.common_reply()}
            onclick={() => (replyToId = replyToId === c.id ? null : c.id)}>
            <Icon name="reply" class="h-4 w-4" />
          </button>
        {/if}
        {#if c.author?.id === auth.user?.id}
          <button
            class="btn-icon"
            title={m.common_edit()}
            aria-label={m.common_edit()}
            onclick={() => startEdit(c)}>
            <Icon name="edit" class="h-4 w-4" />
          </button>
          <button
            class="btn-icon hover:text-danger"
            title={m.common_delete()}
            aria-label={m.common_delete()}
            onclick={() => (confirmDeleteId = c.id)}>
            <Icon name="trash" class="h-4 w-4" />
          </button>
        {:else}
          <button
            class="btn-icon"
            title={m.common_report()}
            aria-label={m.common_report()}
            onclick={() => openReport(c.id)}>
            <Icon name="flag" class="h-4 w-4" />
          </button>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#snippet commentCard(
  c: CommentDto,
  isReply: boolean,
  focused: boolean = false,
)}
  <div
    id="comment-{c.id}"
    class="card group overflow-visible p-3 {isReply ? 'ml-8' : ''}"
    use:longpress={{
      onLongPress: () => !focused && (focusedId = c.id),
      duration: 1000,
    }}>
    {#if c.deleted}
      <p class="text-dim text-sm italic">
        {c.deletedByAdmin ? m.comment_deleted_by_admin() : m.comment_deleted()}
      </p>
    {:else if c.masked && !revealed.has(c.id)}
      <button
        class="border-border text-dim hover:text-fg hover:border-accent/40 flex w-full items-center gap-2 rounded-lg border border-dashed py-2 text-sm transition"
        onclick={() => reveal(c.id)}>
        <Icon name="eye-off" class="h-4 w-4 shrink-0" />
        {m.comment_reveal_spoiler()}
      </button>
    {:else}
      <div class="flex items-start gap-3">
        {#if !c.author}
          <span class="shrink-0">
            <Avatar seed="utilisateur-supprime" size={28} />
          </span>
        {:else if c.author.anonymized}
          <!-- Seeded on the derived pseudonym, never the real id — a stable
               seed would let the same identicon resurface across unrelated
               threads and quietly de-anonymize the author. -->
          <span class="shrink-0">
            <Avatar seed={c.author.displayName} size={28} />
          </span>
        {:else}
          <a href="/app/u/{c.author.username}" class="shrink-0">
            <Avatar
              seed={c.author.username}
              url={c.author.avatarUrl}
              size={28} />
          </a>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            {#if !c.author}
              <span class="text-dim truncate text-sm font-semibold italic">
                {m.common_deleted_user()}
              </span>
            {:else if c.author.anonymized}
              <span class="timecode truncate text-sm font-semibold">
                {c.author.displayName}
              </span>
            {:else}
              <a
                href="/app/u/{c.author.username}"
                class="truncate text-sm font-semibold hover:underline">
                {c.author.displayName}
              </a>
              {#if appConfig.gamificationEnabled}
                <LevelBadge xp={c.author.xp} />
              {/if}
            {/if}
            <RelativeTime iso={c.createdAt} class="timecode text-xs" />
            {#if c.edited}
              <span class="text-dim text-xs">{m.comment_edited_marker()}</span>
            {/if}
          </div>

          {#if editingId === c.id}
            <div class="mt-1 flex flex-wrap items-center gap-2">
              {#if allowSpoilerTag}
                <button
                  type="button"
                  aria-pressed={editSpoilerTag}
                  title={editSpoilerTag
                    ? m.comment_unmark_spoiler()
                    : m.comment_mark_spoiler()}
                  aria-label={editSpoilerTag
                    ? m.comment_unmark_spoiler()
                    : m.comment_mark_spoiler()}
                  onclick={() => (editSpoilerTag = !editSpoilerTag)}
                  class="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors {editSpoilerTag
                    ? 'border-accent text-accent'
                    : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
                  <Icon name="eye-off" class="h-4 w-4" />
                </button>
              {/if}
              <div class="relative min-w-32 flex-1">
                <input
                  type="text"
                  name="commentText"
                  aria-label={m.common_edit()}
                  class="input pr-14 text-sm"
                  minlength="1"
                  maxlength={COMMENT_TEXT_MAX_LENGTH}
                  required
                  enterkeyhint="send"
                  bind:value={editText}
                  onkeydown={(e) => e.key === "Enter" && submitEdit(c.id)} />
                <span
                  class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] tabular-nums">
                  {editText.length}/{COMMENT_TEXT_MAX_LENGTH}
                </span>
              </div>
              <button
                class="btn btn-primary btn-sm shrink-0"
                onclick={() => submitEdit(c.id)}>
                {m.common_save()}
              </button>
              <button
                class="btn btn-ghost btn-sm shrink-0"
                onclick={() => (editingId = null)}>
                {m.common_cancel()}
              </button>
            </div>
          {:else}
            <p
              class="mt-0.5 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
              {c.text}
            </p>
          {/if}

          {@render actionRow(c, isReply, focused)}

          {#if replyToId === c.id}
            <div class="mt-2 flex flex-wrap items-center gap-2">
              {#if allowSpoilerTag}
                <button
                  type="button"
                  aria-pressed={replySpoilerTag}
                  title={replySpoilerTag
                    ? m.comment_unmark_spoiler()
                    : m.comment_mark_spoiler()}
                  aria-label={replySpoilerTag
                    ? m.comment_unmark_spoiler()
                    : m.comment_mark_spoiler()}
                  onclick={() => (replySpoilerTag = !replySpoilerTag)}
                  class="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors {replySpoilerTag
                    ? 'border-accent text-accent'
                    : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
                  <Icon name="eye-off" class="h-4 w-4" />
                </button>
              {/if}
              <div class="relative min-w-32 flex-1">
                <label class="sr-only" for="comment-reply-{c.id}"
                  >{m.comment_reply_label()}</label>
                <input
                  id="comment-reply-{c.id}"
                  type="text"
                  name="replyText"
                  class="input pr-14 text-sm"
                  placeholder={!c.author
                    ? m.comment_reply_placeholder()
                    : c.author.anonymized
                      ? m.comment_reply_to({ name: c.author.displayName })
                      : m.comment_reply_to({ name: `@${c.author.username}` })}
                  maxlength={COMMENT_TEXT_MAX_LENGTH}
                  minlength="1"
                  required
                  enterkeyhint="send"
                  bind:value={replyText}
                  onkeydown={(e) => e.key === "Enter" && submitReply(c.id)} />
                <span
                  class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] tabular-nums">
                  {replyText.length}/{COMMENT_TEXT_MAX_LENGTH}
                </span>
              </div>
              <button
                class="btn btn-primary btn-sm shrink-0"
                disabled={!replyText.trim() || cooldownRemaining > 0}
                onclick={() => submitReply(c.id)}>
                {cooldownRemaining > 0
                  ? m.common_wait_seconds({ seconds: cooldownRemaining })
                  : m.common_reply()}
              </button>
              <button
                class="btn btn-ghost btn-sm shrink-0"
                onclick={() => (replyToId = null)}>
                {m.common_cancel()}
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<section class="min-h-0 flex-1">
  <div class="flex min-h-0 flex-col">
    {#if canParticipate}
      <div
        class="border-border order-2 mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        {#if allowSpoilerTag}
          <button
            type="button"
            aria-pressed={newSpoilerTag}
            title={newSpoilerTag
              ? m.comment_unmark_spoiler()
              : m.comment_mark_spoiler()}
            aria-label={newSpoilerTag
              ? m.comment_unmark_spoiler()
              : m.comment_mark_spoiler()}
            onclick={() => (newSpoilerTag = !newSpoilerTag)}
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors {newSpoilerTag
              ? 'border-accent text-accent'
              : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
            <Icon name="eye-off" class="h-4 w-4" />
          </button>
        {/if}
        <div class="relative min-w-32 flex-1">
          <label class="sr-only" for="comment-add-text"
            >{m.comment_add_label()}</label>
          <input
            id="comment-add-text"
            type="text"
            name="commentText"
            class="input pr-14 text-sm"
            placeholder={m.comment_add_placeholder()}
            maxlength={COMMENT_TEXT_MAX_LENGTH}
            minlength="1"
            required
            enterkeyhint="send"
            bind:value={newText}
            onkeydown={(e) => e.key === "Enter" && submitTop()} />
          <span
            class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] tabular-nums">
            {newText.length}/{COMMENT_TEXT_MAX_LENGTH}
          </span>
        </div>
        <button
          class="btn btn-primary btn-sm shrink-0"
          disabled={!newText.trim() ||
            createMut.isPending ||
            cooldownRemaining > 0}
          onclick={submitTop}>
          {cooldownRemaining > 0
            ? m.common_wait_seconds({ seconds: cooldownRemaining })
            : m.common_publish()}
        </button>
      </div>
    {:else}
      <p class="border-border text-dim order-2 mt-4 border-t pt-4 text-sm">
        {m.comments_track_to_participate()}
      </p>
    {/if}

    {#if query.isPending}
      <p class="text-dim text-sm">{m.common_loading()}</p>
    {:else if query.isError}
      <div class="text-dim flex items-center justify-between gap-3 text-sm">
        <span>{m.comments_load_failed()}</span>
        <button class="btn btn-ghost btn-sm" onclick={() => query.refetch()}>
          {m.common_retry()}
        </button>
      </div>
    {:else if visibleComments.length === 0}
      <p class="text-dim text-sm">{m.comments_empty()}</p>
    {:else}
      <div class="relative">
        <div class="flex flex-col gap-2">
          {#each displayedComments as c (c.id)}
            {@const shownReplies = repliesOf(c)}
            {@const hiddenReplyCount = Math.max(
              0,
              c.replyCount - shownReplies.length,
            )}
            {@render commentCard(c, false)}
            {#each shownReplies as r (r.id)}
              {#if !r.deleted}
                {@render commentCard(r, true)}
              {/if}
            {/each}
            {#if hiddenReplyCount > 0}
              <button
                type="button"
                class="timecode ml-8 block text-left text-xs hover:underline disabled:opacity-50"
                disabled={loadingReplies.has(c.id)}
                onclick={() => expandReplies(c.id)}>
                {hiddenReplyCount === 1
                  ? m.comments_more_replies_one({ count: hiddenReplyCount })
                  : m.comments_more_replies_many({ count: hiddenReplyCount })}
              </button>
            {/if}
          {/each}
        </div>
      </div>

      {#if query.hasNextPage}
        <button
          class="btn btn-ghost btn-sm mt-3"
          disabled={query.isFetchingNextPage}
          onclick={() => query.fetchNextPage()}>
          {m.common_load_more()}
        </button>
      {/if}
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
  <Modal title={m.comment_report_title()} onclose={() => (reportingId = null)}>
    <div class="flex flex-col gap-3">
      <div>
        <Combobox
          label={m.common_category()}
          options={reportCategoryOptions}
          values={reportCategory ? [reportCategory] : []}
          onChange={(v) => chooseReportCategory(v[0] as ReportCategory)} />
        {#if reportCategory}
          <p class="text-dim mt-1.5 text-xs">
            {REPORT_CATEGORY_HINTS[reportCategory]}
          </p>
        {/if}
      </div>

      {#if reportMotifOptions.length > 1}
        <ul class="divide-border flex flex-col divide-y">
          {#each reportMotifOptions as motif (motif)}
            <li>
              <label
                class="flex cursor-pointer items-center gap-2.5 py-2 text-sm">
                <input
                  type="radio"
                  name="report-motif"
                  value={motif}
                  class="accent-accent h-4 w-4 shrink-0"
                  checked={reportMotif === motif}
                  onchange={() => (reportMotif = motif)} />
                {REPORT_MOTIF_LABELS[motif]}
              </label>
            </li>
          {/each}
        </ul>
      {/if}

      {#if reportCategory}
        <textarea
          name="reason"
          aria-label={reportIsOther
            ? m.report_reason_placeholder()
            : m.report_detail_placeholder()}
          class="input min-h-20 resize-y text-sm"
          rows="3"
          placeholder={reportIsOther
            ? m.report_reason_placeholder()
            : m.report_detail_placeholder()}
          maxlength={500}
          bind:value={reportReason}></textarea>
      {/if}
    </div>

    <div class="mt-3 flex justify-end gap-2">
      <button class="btn btn-ghost" onclick={() => (reportingId = null)}>
        {m.common_cancel()}
      </button>
      <button
        class="btn btn-primary"
        disabled={!canSubmitReport}
        onclick={submitReport}>
        {m.common_report()}
      </button>
    </div>
  </Modal>
{/if}
