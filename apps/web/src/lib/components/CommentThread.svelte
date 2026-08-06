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
    REPORT_CATEGORY_MOTIFS,
    type CommentDto,
    type CommentEmote,
    type CommentPageDto,
    type CommentTargetType,
    type ReportCategory,
    type ReportMotif,
  } from "@loomkeep/shared";
  import {
    REPORT_CATEGORY_HINTS,
    REPORT_CATEGORY_LABELS,
    REPORT_CATEGORY_ORDER,
    REPORT_MOTIF_LABELS,
  } from "$lib/report-labels";
  import Avatar from "./Avatar.svelte";
  import Combobox from "./Combobox.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import StreakBadge from "./StreakBadge.svelte";

  let {
    targetType,
    targetId,
    digest = false,
  }: {
    targetType: CommentTargetType;
    targetId: string;
    /** Media detail page ("Cinéma minimal"): always expanded, top-level
     * comments capped at 5 and replies at the last 2, each behind a discreet
     * mono "+N" reveal instead of the collapsed-by-default gate below. */
    digest?: boolean;
  } = $props();

  const queryClient = useQueryClient();
  const key = $derived(["comments", targetType, targetId] as const);
  const countKey = $derived(["comment-count", targetType, targetId] as const);

  // Collapsed by default — the thread only opens on demand (see
  // conversation with Logan, 2026-07-21: comments shouldn't dominate the
  // detail page the way the single-per-person review does). `digest` pages
  // opt out: they show a capped list up front instead of gating it entirely.
  let expanded = $state(digest);

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

  // Digest mode's own progressive disclosure: capped top-level list (reveals
  // everything already loaded in one go, rather than incrementally) and a
  // per-comment "show earlier replies" set.
  let showAllTop = $state(false);
  let expandedReplies = $state<Set<string>>(new Set());
  const displayedComments = $derived(
    digest && !showAllTop ? visibleComments.slice(0, 5) : visibleComments,
  );
  const hiddenTopCount = $derived(
    digest && !showAllTop ? Math.max(0, visibleComments.length - 5) : 0,
  );

  function expandReplies(id: string) {
    expandedReplies = new Set(expandedReplies).add(id);
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
    {:else if c.masked && !revealed.has(c.id)}
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
            <div class="mt-1 flex flex-wrap items-center gap-2">
              {#if allowSpoilerTag}
                <button
                  type="button"
                  aria-pressed={editSpoilerTag}
                  title={editSpoilerTag
                    ? "Retirer le tag spoiler"
                    : "Marquer comme spoiler"}
                  aria-label={editSpoilerTag
                    ? "Retirer le tag spoiler"
                    : "Marquer comme spoiler"}
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
                  class="input pr-14 text-sm"
                  maxlength={COMMENT_TEXT_MAX_LENGTH}
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
                Enregistrer
              </button>
              <button
                class="btn btn-ghost btn-sm shrink-0"
                onclick={() => (editingId = null)}>
                Annuler
              </button>
            </div>
          {:else}
            <p
              class="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {c.text}
            </p>
          {/if}

          {@render actionRow(c, isReply, focused)}

          {#if replyToId === c.id}
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <div class="relative min-w-32 flex-1">
                <input
                  type="text"
                  class="input pr-14 text-sm"
                  placeholder={c.author.anonymized
                    ? `Répondre à ${c.author.displayName}…`
                    : `Répondre à @${c.author.username}…`}
                  maxlength={COMMENT_TEXT_MAX_LENGTH}
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
                  ? `Patiente ${cooldownRemaining}s`
                  : "Répondre"}
              </button>
              <button
                class="btn btn-ghost btn-sm shrink-0"
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
  {#if digest}
    <h2 class="font-display mb-3 text-xl font-bold">
      Commentaires
      {#if countQuery.data}
        <span class="text-dim font-normal">({countQuery.data.count})</span>
      {/if}
    </h2>
  {:else}
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
  {/if}

  {#if expanded}
    <div class="mt-3">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        {#if allowSpoilerTag}
          <button
            type="button"
            aria-pressed={newSpoilerTag}
            title={newSpoilerTag
              ? "Retirer le tag spoiler"
              : "Marquer comme spoiler"}
            aria-label={newSpoilerTag
              ? "Retirer le tag spoiler"
              : "Marquer comme spoiler"}
            onclick={() => (newSpoilerTag = !newSpoilerTag)}
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors {newSpoilerTag
              ? 'border-accent text-accent'
              : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
            <Icon name="eye-off" class="h-4 w-4" />
          </button>
        {/if}
        <div class="relative min-w-32 flex-1">
          <input
            type="text"
            class="input pr-14 text-sm"
            placeholder="Ajouter un commentaire…"
            maxlength={COMMENT_TEXT_MAX_LENGTH}
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
          {cooldownRemaining > 0 ? `Patiente ${cooldownRemaining}s` : "Publier"}
        </button>
      </div>

      {#if query.isPending}
        <p class="text-dim text-sm">Chargement…</p>
      {:else if visibleComments.length === 0}
        <p class="text-dim text-sm">Aucun commentaire pour l'instant.</p>
      {:else}
        <div class="relative">
          <div class="flex flex-col gap-2">
            {#each displayedComments as c (c.id)}
              {@const shownReplies =
                digest && !expandedReplies.has(c.id)
                  ? c.replies.slice(-2)
                  : c.replies}
              {@const hiddenReplyCount =
                digest && !expandedReplies.has(c.id)
                  ? Math.max(0, c.replies.length - 2)
                  : 0}
              {@render commentCard(c, false)}
              {#each shownReplies as r (r.id)}
                {#if !r.deleted}
                  {@render commentCard(r, true)}
                {/if}
              {/each}
              {#if hiddenReplyCount > 0}
                <button
                  type="button"
                  class="timecode ml-8 block text-left text-xs hover:underline"
                  onclick={() => expandReplies(c.id)}>
                  +{hiddenReplyCount} réponse{hiddenReplyCount > 1 ? "s" : ""}
                </button>
              {/if}
            {/each}
          </div>

          {#if hiddenTopCount > 0}
            <div
              class="from-bg via-bg/90 pointer-events-none absolute inset-x-0 -bottom-2 flex h-16 items-end justify-center bg-linear-to-t to-transparent pb-1">
              <button
                type="button"
                class="chip timecode pointer-events-auto"
                onclick={() => (showAllTop = true)}>
                +{hiddenTopCount} commentaire{hiddenTopCount > 1 ? "s" : ""}
              </button>
            </div>
          {/if}
        </div>

        {#if (!digest || showAllTop) && query.hasNextPage}
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
    <div class="flex flex-col gap-3">
      <div>
        <Combobox
          label="Catégorie"
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
          class="input min-h-20 resize-y text-sm"
          placeholder={reportIsOther
            ? "Explique le problème…"
            : "Détail (optionnel)…"}
          maxlength={500}
          bind:value={reportReason}></textarea>
      {/if}
    </div>

    <div class="mt-3 flex justify-end gap-2">
      <button class="btn btn-ghost" onclick={() => (reportingId = null)}>
        Annuler
      </button>
      <button
        class="btn btn-primary"
        disabled={!canSubmitReport}
        onclick={submitReport}>
        Signaler
      </button>
    </div>
  </Modal>
{/if}
