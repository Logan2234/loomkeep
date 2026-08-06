<script lang="ts">
  import {
    createInfiniteQuery,
    createMutation,
    createQuery,
    useQueryClient,
    type InfiniteData,
  } from "@tanstack/svelte-query";
  import {
    createComment,
    deleteComment,
    getCommentCount,
    getComments,
    reactToComment,
    reportComment,
    unreactToComment,
    updateComment,
  } from "$lib/api/client";
  import { scale } from "svelte/transition";
  import { longpress } from "$lib/actions/longpress";
  import { auth } from "$lib/auth.svelte";
  import FocusOverlay from "$lib/components/FocusOverlay.svelte";
  import RelativeTime from "$lib/components/RelativeTime.svelte";
  import { toast } from "$lib/toast.svelte";
  import {
    COMMENT_EMOTE_DISPLAY,
    COMMENT_TEXT_MAX_LENGTH,
    type CommentDto,
    type CommentEmote,
    type CommentPageDto,
    type CommentTargetType,
  } from "@loomkeep/shared";
  import Avatar from "./Avatar.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import StreakBadge from "./StreakBadge.svelte";

  let {
    targetType,
    targetId,
  }: { targetType: CommentTargetType; targetId: string } = $props();

  const queryClient = useQueryClient();
  const key = $derived(["comments", targetType, targetId] as const);
  const countKey = $derived(["comment-count", targetType, targetId] as const);

  // Collapsed by default — the thread only opens on demand (see
  // conversation with Logan, 2026-07-21: comments shouldn't dominate the
  // detail page the way the single-per-person review does).
  let expanded = $state(false);

  const countQuery = createQuery(() => ({
    queryKey: countKey,
    queryFn: () => getCommentCount(targetType, targetId),
  }));

  const query = createInfiniteQuery<
    CommentPageDto,
    Error,
    InfiniteData<CommentPageDto>,
    typeof key,
    string | undefined
  >(() => ({
    queryKey: key,
    queryFn: ({ pageParam }) => getComments(targetType, targetId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: expanded,
    // Only the currently-open thread polls, and only while the tab is active.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  }));

  const comments = $derived(query.data?.pages.flatMap((p) => p.comments) ?? []);
  // A deleted top-level comment only earns its tombstone when it still has
  // replies to keep attached; with none, there's nothing left to preserve so
  // it's simply dropped. A deleted reply never has children of its own, so
  // it's always dropped — no tombstone case applies to it.
  const visibleComments = $derived(
    comments.filter((c) => !(c.deleted && c.replies.length === 0)),
  );

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
  let editingId = $state<string | null>(null);
  let editText = $state("");
  let editSpoilerTag = $state(false);
  let reactingId = $state<string | null>(null);
  let revealed = $state<Set<string>>(new Set());
  let ignoreSpoilers = $state(false);
  let confirmDeleteId = $state<string | null>(null);
  let reportingId = $state<string | null>(null);
  let reportReason = $state("");

  // Long-press focus (touch): centers the pressed comment with a blurred
  // backdrop and reveals its actions, mirroring the desktop hover reveal.
  let focusedId = $state<string | null>(null);
  const focused = $derived.by(() => {
    if (!focusedId) return null;
    for (const c of visibleComments) {
      if (c.id === focusedId) return { comment: c, isReply: false };
      const reply = c.replies.find((r) => r.id === focusedId);
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
    await createMut.mutateAsync({
      targetType,
      targetId,
      text,
      spoilerTag: allowSpoilerTag ? newSpoilerTag : undefined,
    });
    newText = "";
    newSpoilerTag = false;
    startCooldown();
  }

  async function submitReply(parentId: string) {
    const text = replyText.trim();
    if (!text || cooldownRemaining > 0) return;
    await createMut.mutateAsync({ targetType, targetId, parentId, text });
    replyText = "";
    replyToId = null;
    startCooldown();
  }

  function startEdit(c: CommentDto) {
    editingId = c.id;
    editText = c.text ?? "";
    editSpoilerTag = c.spoilerTag;
  }

  async function submitEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    await updateMut.mutateAsync({
      id,
      text,
      spoilerTag: allowSpoilerTag ? editSpoilerTag : undefined,
    });
    editingId = null;
  }

  async function confirmRemove() {
    if (!confirmDeleteId) return;
    await deleteMut.mutateAsync(confirmDeleteId);
    confirmDeleteId = null;
  }

  async function react(id: string, emote: CommentEmote) {
    reactingId = null;
    await reactMut.mutateAsync({ id, emote });
  }

  function openReport(id: string) {
    reportingId = id;
    reportReason = "";
  }

  async function submitReport() {
    if (!reportingId) return;
    try {
      await reportComment(reportingId, reportReason.trim() || undefined);
      toast.success("Commentaire signalé.");
    } catch {
      toast.error("Le signalement a échoué.");
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
          onclick={() =>
            c.myReaction === emote
              ? unreactMut.mutate(c.id)
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
      class="ml-auto flex items-center gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 {forceShow ||
      reactingId === c.id
        ? 'opacity-100'
        : 'opacity-0'}">
      <div class="relative">
        <button
          class="text-dim hover:text-fg hover:bg-surface-2 grid h-6 w-6 place-items-center rounded-full"
          title="Réagir"
          aria-label="Réagir"
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

      <!-- Icon-only: title/aria-label carry the meaning instead of visible
           text, to keep the row compact. -->
      <div class="text-dim flex items-center gap-0.5">
        {#if !isReply}
          <button
            class="hover:text-fg hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-full"
            title="Répondre"
            aria-label="Répondre"
            onclick={() => (replyToId = replyToId === c.id ? null : c.id)}>
            <Icon name="reply" class="h-4 w-4" />
          </button>
        {/if}
        {#if c.author.id === auth.user?.id}
          <button
            class="hover:text-fg hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-full"
            title="Modifier"
            aria-label="Modifier"
            onclick={() => startEdit(c)}>
            <Icon name="edit" class="h-4 w-4" />
          </button>
          <button
            class="hover:text-danger hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-full"
            title="Supprimer"
            aria-label="Supprimer"
            onclick={() => (confirmDeleteId = c.id)}>
            <Icon name="trash" class="h-4 w-4" />
          </button>
        {:else}
          <button
            class="hover:text-fg hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-full"
            title="Signaler"
            aria-label="Signaler"
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
    class="card group overflow-visible p-3 {isReply ? 'ml-8' : ''}"
    use:longpress={{
      onLongPress: () => !focused && (focusedId = c.id),
      duration: 1000,
    }}>
    {#if c.deleted}
      <p class="text-dim text-sm italic">
        {c.deletedByAdmin
          ? "Commentaire supprimé par un administrateur."
          : "Commentaire supprimé."}
      </p>
    {:else if c.masked && !revealed.has(c.id) && !ignoreSpoilers}
      <button
        class="border-border text-dim hover:text-fg hover:border-accent/40 flex w-full items-center gap-2 rounded-lg border border-dashed py-2 text-sm transition"
        onclick={() => reveal(c.id)}>
        <Icon name="eye-off" class="h-4 w-4 shrink-0" />
        Spoiler potentiel — cliquer pour afficher
      </button>
    {:else}
      <div class="flex items-start gap-3">
        {#if c.author.anonymized}
          <!-- Seeded on the derived pseudonym, never the real id — a stable
               seed would let the same identicon resurface across unrelated
               threads and quietly de-anonymize the author. -->
          <span class="shrink-0">
            <Avatar seed={c.author.displayName} size={28} />
          </span>
        {:else}
          <a href="/u/{c.author.username}" class="shrink-0">
            <Avatar seed={c.author.username} size={28} />
          </a>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            {#if c.author.anonymized}
              <span class="timecode truncate text-sm font-semibold">
                {c.author.displayName}
              </span>
            {:else}
              <a
                href="/u/{c.author.username}"
                class="truncate text-sm font-semibold hover:underline">
                {c.author.displayName}
              </a>
              <StreakBadge days={c.author.streakDays} />
            {/if}
            <RelativeTime iso={c.createdAt} class="timecode text-xs" />
            {#if c.edited}
              <span class="text-dim text-xs">· modifié</span>
            {/if}
          </div>

          {#if editingId === c.id}
            <textarea
              class="input mt-1 min-h-16 resize-y text-sm"
              maxlength={COMMENT_TEXT_MAX_LENGTH}
              bind:value={editText}></textarea>
            <p class="text-dim mt-0.5 text-right text-xs">
              {editText.length}/{COMMENT_TEXT_MAX_LENGTH}
            </p>
            {#if allowSpoilerTag}
              <label class="mt-1 flex items-center gap-1.5 text-xs">
                <input type="checkbox" bind:checked={editSpoilerTag} />
                Contient un spoiler
              </label>
            {/if}
            <div class="mt-1 flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                onclick={() => submitEdit(c.id)}>
                Enregistrer
              </button>
              <button
                class="btn btn-ghost btn-sm"
                onclick={() => (editingId = null)}>
                Annuler
              </button>
            </div>
          {:else}
            <p class="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
              {c.text}
            </p>
          {/if}

          {@render actionRow(c, isReply, focused)}

          {#if replyToId === c.id}
            <div class="mt-2 flex gap-2">
              <textarea
                class="input min-h-12 resize-y text-sm"
                placeholder={c.author.anonymized
                  ? `Répondre à ${c.author.displayName}…`
                  : `Répondre à @${c.author.username}…`}
                maxlength={COMMENT_TEXT_MAX_LENGTH}
                bind:value={replyText}></textarea>
            </div>
            <p class="text-dim mt-0.5 text-right text-xs">
              {replyText.length}/{COMMENT_TEXT_MAX_LENGTH}
            </p>
            <div class="mt-2 flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                disabled={!replyText.trim() || cooldownRemaining > 0}
                onclick={() => submitReply(c.id)}>
                {cooldownRemaining > 0
                  ? `Patiente ${cooldownRemaining}s`
                  : "Répondre"}
              </button>
              <button
                class="btn btn-ghost btn-sm"
                onclick={() => (replyToId = null)}>
                Annuler
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<section class="mt-6">
  <button
    type="button"
    class="border-border hover:bg-surface-2 flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-2.5"
    onclick={() => (expanded = !expanded)}>
    <span class="flex items-center gap-1.5 text-sm font-semibold">
      <Icon name="message" class="h-4 w-4" />
      Commentaires
      {#if countQuery.data}
        <span class="text-dim font-normal">({countQuery.data.count})</span>
      {/if}
    </span>
    <Icon
      name="chevron-right"
      class="text-dim h-4 w-4 transition-transform {expanded
        ? 'rotate-90'
        : ''}" />
  </button>

  {#if expanded}
    <div class="mt-3">
      {#if allowSpoilerTag}
        <div class="mb-3 flex items-center justify-end">
          <button
            class="text-dim hover:text-fg text-xs underline"
            onclick={() => (ignoreSpoilers = !ignoreSpoilers)}>
            {ignoreSpoilers
              ? "Réactiver le flou spoiler"
              : "Ignorer les spoilers pour cette session"}
          </button>
        </div>
      {/if}

      <div class="mb-4">
        <textarea
          class="input min-h-16 resize-y text-sm"
          placeholder="Ajouter un commentaire…"
          maxlength={COMMENT_TEXT_MAX_LENGTH}
          bind:value={newText}></textarea>
        <p class="text-dim mt-0.5 text-right text-xs">
          {newText.length}/{COMMENT_TEXT_MAX_LENGTH}
        </p>
        <div class="mt-1 flex items-center justify-between gap-2">
          {#if allowSpoilerTag}
            <label class="text-dim flex items-center gap-1.5 text-xs">
              <input type="checkbox" bind:checked={newSpoilerTag} />
              Contient un spoiler
            </label>
          {:else}
            <span></span>
          {/if}
          <button
            class="btn btn-primary btn-sm"
            disabled={!newText.trim() ||
              createMut.isPending ||
              cooldownRemaining > 0}
            onclick={submitTop}>
            {cooldownRemaining > 0
              ? `Patiente ${cooldownRemaining}s`
              : "Publier"}
          </button>
        </div>
      </div>

      {#if query.isPending}
        <p class="text-dim text-sm">Chargement…</p>
      {:else if visibleComments.length === 0}
        <p class="text-dim text-sm">Aucun commentaire pour l'instant.</p>
      {:else}
        <div class="flex flex-col gap-2">
          {#each visibleComments as c (c.id)}
            {@render commentCard(c, false)}
            {#each c.replies as r (r.id)}
              {#if !r.deleted}
                {@render commentCard(r, true)}
              {/if}
            {/each}
          {/each}
        </div>

        {#if query.hasNextPage}
          <button
            class="btn btn-ghost btn-sm mt-3"
            disabled={query.isFetchingNextPage}
            onclick={() => query.fetchNextPage()}>
            Charger la suite
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</section>

{#if confirmDeleteId}
  <ConfirmationModal
    title="Supprimer le commentaire"
    message="Le texte sera retiré ; les réponses éventuelles resteront visibles."
    confirmLabel="Supprimer"
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
  <Modal title="Signaler ce commentaire" onclose={() => (reportingId = null)}>
    <textarea
      class="input min-h-20 resize-y text-sm"
      placeholder="Raison du signalement (optionnel)…"
      maxlength={500}
      bind:value={reportReason}></textarea>
    <div class="mt-3 flex justify-end gap-2">
      <button class="btn btn-ghost" onclick={() => (reportingId = null)}>
        Annuler
      </button>
      <button class="btn btn-primary" onclick={submitReport}>Signaler</button>
    </div>
  </Modal>
{/if}
