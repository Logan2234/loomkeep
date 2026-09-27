<script lang="ts">
  import {
    createBookSession,
    deleteBookSession,
    getBookSessions,
    updateBookSession,
  } from "$lib/api/books";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    formatSessionMinutes,
    localDateInput,
    sessionDateToIso,
  } from "$lib/session-presentation";
  import type {
    BookEntryDto,
    BookSessionDto,
    BookSessionMutationDto,
    CreateBookSessionDto,
    UpdateBookSessionDto,
  } from "@loomkeep/shared";
  import type { QueryKey } from "@tanstack/svelte-query";
  import Banner from "./Banner.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import ProgressBar from "./ProgressBar.svelte";

  let {
    entry,
    detailKey,
    onMarkFinished,
  }: {
    entry: BookEntryDto;
    detailKey: QueryKey;
    onMarkFinished: () => void;
  } = $props();

  type PageMode = "quantity" | "range";

  const quickDurations = [15, 30, 45, 60] as const;
  const today = localDateInput();
  let durationMinutes = $state(30);
  let occurredOn = $state(today);
  let mode = $state<PageMode>("quantity");
  let pagesRead = $state(10);
  let startPage = $state(0);
  let endPage = $state(10);
  let page = $state(1);
  let editingId = $state<string | null>(null);
  let editDuration = $state(0);
  let editDate = $state(today);
  let editMode = $state<PageMode>("quantity");
  let editPagesRead = $state(0);
  let editStartPage = $state(0);
  let editEndPage = $state(1);
  let deletingId = $state<string | null>(null);
  let savedToday = $state(false);
  let totalPulse = $state(false);
  let initializedEntryId = $state<string | null>(null);

  $effect(() => {
    if (initializedEntryId === entry.id) return;
    initializedEntryId = entry.id;
    startPage = Math.max(0, entry.currentPage);
    endPage = Math.max(1, entry.currentPage + 10);
  });

  const referencePages = $derived(entry.referencePageCount);
  const progressPct = $derived(
    referencePages
      ? Math.min(100, Math.round((entry.currentPage / referencePages) * 100))
      : 0,
  );
  const sessionKey = $derived(keys.books.sessions(entry.id, page));
  const sessionsQuery = createApiQuery(() => ({
    key: sessionKey,
    fetch: () => getBookSessions(entry.id, page),
  }));
  const summary = $derived(sessionsQuery.data);

  function pulseTotal() {
    totalPulse = false;
    requestAnimationFrame(() => (totalPulse = true));
    setTimeout(() => (totalPulse = false), 650);
  }

  const createMut = createApiMutation<
    CreateBookSessionDto,
    BookSessionMutationDto
  >(() => ({
    mutate: (body) => createBookSession(entry.id, body),
    invalidates: [
      keys.books.sessionsRoot(entry.id),
      detailKey,
      keys.stats.books(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: (_result, body) => {
      page = 1;
      savedToday = localDateInput(new Date(body.occurredAt)) === today;
      pulseTotal();
    },
    successToast: (result) =>
      result.xpAwarded ? m.session_saved_xp() : m.session_saved(),
    errorToast: true,
  }));

  const updateMut = createApiMutation<
    { id: string; body: UpdateBookSessionDto },
    BookSessionMutationDto
  >(() => ({
    mutate: ({ id, body }) => updateBookSession(id, body),
    invalidates: [
      keys.books.sessionsRoot(entry.id),
      detailKey,
      keys.stats.books(),
      keys.stats.social(),
      keys.feed.all(),
    ],
    onSuccess: () => {
      editingId = null;
      pulseTotal();
    },
    successToast: m.session_saved(),
    errorToast: true,
  }));

  const deleteMut = createApiMutation<string, void>(() => ({
    mutate: (id) => deleteBookSession(id),
    invalidates: [
      keys.books.sessionsRoot(entry.id),
      detailKey,
      keys.stats.books(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: () => {
      deletingId = null;
      pulseTotal();
    },
    successToast: m.session_deleted(),
    errorToast: true,
  }));

  function submit() {
    if (!referencePages || durationMinutes < 1) return;
    const pageData =
      mode === "quantity" ? { pagesRead } : { startPage, endPage };
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
      ...pageData,
    });
  }

  function beginEdit(session: BookSessionDto) {
    editingId = session.id;
    editDuration = session.durationMinutes;
    editDate = localDateInput(new Date(session.occurredAt));
    editMode = session.startPage === null ? "quantity" : "range";
    editPagesRead = session.pagesRead;
    editStartPage = session.startPage ?? 1;
    editEndPage = session.endPage ?? Math.max(1, session.pagesRead);
  }

  function saveEdit(id: string) {
    if (editDuration < 1) return;
    const pageData: UpdateBookSessionDto =
      editMode === "quantity"
        ? {
            pagesRead: editPagesRead,
            startPage: null,
            endPage: null,
          }
        : {
            pagesRead: editEndPage - editStartPage,
            startPage: editStartPage,
            endPage: editEndPage,
          };
    updateMut.mutate({
      id,
      body: {
        durationMinutes: editDuration,
        occurredAt: sessionDateToIso(editDate),
        ...pageData,
      },
    });
  }
</script>

<section
  class="border-border bg-bg/45 relative overflow-hidden rounded-xl border p-3.5 pr-7"
  aria-labelledby="book-session-title">
  <div class="bookmark-track bg-surface-2" aria-hidden="true">
    <div class="bookmark-fill bg-accent" style="height: {progressPct}%"></div>
  </div>

  <div class="flex items-start justify-between gap-3">
    <div>
      <h3
        id="book-session-title"
        class="font-display flex items-center gap-2 font-bold">
        <span class="bg-accent/12 text-accent rounded-lg p-1.5">
          <Icon name="book" class="h-4 w-4" />
        </span>
        {m.session_log_title()}
      </h3>
      {#if referencePages}
        <p class="text-dim mt-1 text-xs">
          {m.book_session_reference({ count: referencePages })}
        </p>
      {/if}
    </div>
    <div class="text-right" aria-live="polite">
      <p class="timecode text-[0.58rem] tracking-[0.16em] uppercase">
        {m.book_session_progress()}
      </p>
      <p
        class="font-display text-xl font-extrabold tabular-nums {totalPulse
          ? 'total-pulse'
          : ''}">
        {progressPct} %
      </p>
    </div>
  </div>

  {#if referencePages}
    <div class="mt-3">
      <div class="text-dim mb-1 flex justify-between text-xs tabular-nums">
        <span>{entry.currentPage} / {referencePages}</span>
        <span
          >{summary?.totalPagesRead ?? 0}
          {m.book_session_pages().toLocaleLowerCase()}</span>
      </div>
      <ProgressBar
        value={progressPct}
        label={m.book_session_progress()}
        height="h-2" />
    </div>
  {:else}
    <div class="mt-3">
      <Banner variant="info">{m.book_session_reference_missing()}</Banner>
    </div>
  {/if}

  <div class="bg-surface mt-4 grid grid-cols-2 gap-1 rounded-lg p-1">
    <button
      type="button"
      class="rounded-md px-2 py-1.5 text-xs font-semibold transition-colors {mode ===
      'quantity'
        ? 'bg-bg text-fg shadow-sm'
        : 'text-dim'}"
      aria-pressed={mode === "quantity"}
      onclick={() => (mode = "quantity")}
      >{m.book_session_mode_quantity()}</button>
    <button
      type="button"
      class="rounded-md px-2 py-1.5 text-xs font-semibold transition-colors {mode ===
      'range'
        ? 'bg-bg text-fg shadow-sm'
        : 'text-dim'}"
      aria-pressed={mode === "range"}
      onclick={() => (mode = "range")}>{m.book_session_mode_range()}</button>
  </div>

  <div class="mt-3 grid gap-3 sm:grid-cols-2">
    {#if mode === "quantity"}
      <label class="flex flex-col gap-1.5 text-xs font-semibold">
        {m.book_session_pages()}
        <input
          class="input"
          type="number"
          min="1"
          bind:value={pagesRead}
          disabled={!referencePages || createMut.loading} />
      </label>
    {:else}
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1.5 text-xs font-semibold">
          {m.book_session_start_page()}
          <input
            class="input min-w-0"
            type="number"
            min="0"
            max={referencePages ?? undefined}
            bind:value={startPage}
            disabled={!referencePages || createMut.loading} />
        </label>
        <label class="flex flex-col gap-1.5 text-xs font-semibold">
          {m.book_session_end_page()}
          <input
            class="input min-w-0"
            type="number"
            min="1"
            max={referencePages ?? undefined}
            bind:value={endPage}
            disabled={!referencePages || createMut.loading} />
        </label>
      </div>
    {/if}
    <label class="flex flex-col gap-1.5 text-xs font-semibold">
      {m.session_duration()}
      <span class="flex items-center gap-2">
        <input
          class="input min-w-0 flex-1"
          type="number"
          min="1"
          step="5"
          bind:value={durationMinutes}
          disabled={!referencePages || createMut.loading} />
        <span class="text-dim">{m.session_minutes_short()}</span>
      </span>
    </label>
  </div>

  <div class="mt-2.5 flex flex-wrap gap-1.5">
    {#each quickDurations as minutes (minutes)}
      <button
        type="button"
        class="rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors {durationMinutes ===
        minutes
          ? 'border-accent bg-accent/12 text-accent'
          : 'border-border text-dim hover:text-fg'}"
        aria-pressed={durationMinutes === minutes}
        onclick={() => (durationMinutes = minutes)}
        >{formatSessionMinutes(minutes)}</button>
    {/each}
  </div>

  <label class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
    {m.session_date()}
    <input
      class="input w-full"
      type="date"
      max={today}
      bind:value={occurredOn}
      disabled={!referencePages || createMut.loading} />
  </label>

  <button
    type="button"
    class="btn btn-primary mt-3 w-full"
    disabled={!referencePages ||
      createMut.loading ||
      durationMinutes < 1 ||
      !occurredOn ||
      (mode === "quantity"
        ? pagesRead < 1
        : startPage < 0 || endPage <= startPage)}
    onclick={submit}>
    <Icon name="plus" class="h-4 w-4" />
    {m.session_save()}
  </button>

  {#if savedToday}
    <p class="text-accent mt-2 flex items-center gap-1.5 text-xs font-semibold">
      <Icon name="check" class="h-3.5 w-3.5" />
      {m.session_today_streak()}
    </p>
  {/if}

  {#if summary}
    <dl class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="bg-surface rounded-lg p-2.5">
        <dt class="text-dim text-[0.68rem]">{m.session_week()}</dt>
        <dd class="font-display mt-0.5 font-bold tabular-nums">
          {formatSessionMinutes(summary.weekMinutes)}
        </dd>
      </div>
      <div class="bg-surface rounded-lg p-2.5">
        <dt class="text-dim text-[0.68rem]">{m.session_month()}</dt>
        <dd class="font-display mt-0.5 font-bold tabular-nums">
          {formatSessionMinutes(summary.monthMinutes)}
        </dd>
      </div>
      <div class="bg-surface rounded-lg p-2.5 sm:col-span-2">
        <dt class="text-dim text-[0.68rem]">{m.book_session_pace()}</dt>
        <dd class="font-display mt-0.5 text-sm font-bold">
          {summary.averagePagesPerDay === null
            ? m.book_session_pace_pending()
            : m.book_session_pace_value({ count: summary.averagePagesPerDay })}
        </dd>
        {#if summary.estimatedCompletionDate}
          <p class="text-accent mt-1 text-xs">
            {m.book_session_eta({
              date: formatDate(`${summary.estimatedCompletionDate}T12:00:00`),
            })}
          </p>
        {/if}
      </div>
    </dl>
  {/if}

  {#if summary?.completionSuggested && entry.status !== "READ"}
    <div class="border-accent/40 bg-accent/8 mt-4 rounded-lg border p-3">
      <p class="font-display text-sm font-bold">
        {m.book_session_finish_title()}
      </p>
      <p class="text-dim mt-1 text-xs">{m.book_session_finish_body()}</p>
      <button
        type="button"
        class="btn btn-primary mt-2 text-xs"
        onclick={onMarkFinished}>
        <Icon name="check" class="h-4 w-4" />
        {m.book_session_finish_action()}
      </button>
    </div>
  {/if}

  <div class="border-border mt-4 border-t pt-3">
    <h4 class="timecode text-[0.6rem] tracking-[0.16em] uppercase">
      {m.session_history()}
    </h4>
    {#if sessionsQuery.error}
      <div class="mt-2">
        <Banner variant="error">{sessionsQuery.error}</Banner>
      </div>
    {:else if summary?.items.length}
      <ul class="mt-2 flex flex-col gap-1.5">
        {#each summary.items as session (session.id)}
          <li class="bg-surface rounded-lg p-2.5">
            {#if editingId === session.id}
              <div class="grid gap-2 sm:grid-cols-2">
                <input
                  class="input"
                  type="number"
                  min="1"
                  bind:value={editDuration}
                  aria-label={m.session_duration()} />
                <input
                  class="input"
                  type="date"
                  max={today}
                  bind:value={editDate}
                  aria-label={m.session_date()} />
              </div>
              <div class="bg-bg mt-2 grid grid-cols-2 gap-1 rounded-lg p-1">
                <button
                  type="button"
                  class="rounded-md px-2 py-1 text-xs {editMode === 'quantity'
                    ? 'bg-surface font-semibold'
                    : 'text-dim'}"
                  onclick={() => (editMode = "quantity")}
                  >{m.book_session_mode_quantity()}</button>
                <button
                  type="button"
                  class="rounded-md px-2 py-1 text-xs {editMode === 'range'
                    ? 'bg-surface font-semibold'
                    : 'text-dim'}"
                  onclick={() => (editMode = "range")}
                  >{m.book_session_mode_range()}</button>
              </div>
              {#if editMode === "quantity"}
                <input
                  class="input mt-2 w-full"
                  type="number"
                  min="1"
                  bind:value={editPagesRead}
                  aria-label={m.book_session_pages()} />
              {:else}
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <input
                    class="input min-w-0"
                    type="number"
                    min="0"
                    bind:value={editStartPage}
                    aria-label={m.book_session_start_page()} />
                  <input
                    class="input min-w-0"
                    type="number"
                    min="1"
                    bind:value={editEndPage}
                    aria-label={m.book_session_end_page()} />
                </div>
              {/if}
              <div class="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  class="btn btn-ghost text-xs"
                  onclick={() => (editingId = null)}
                  >{m.common_cancel()}</button>
                <button
                  type="button"
                  class="btn btn-primary text-xs"
                  disabled={updateMut.loading}
                  onclick={() => saveEdit(session.id)}
                  >{m.common_save()}</button>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <p class="font-display text-sm font-bold">
                    {session.pagesRead}
                    {m.book_session_pages().toLocaleLowerCase()} · {formatSessionMinutes(
                      session.durationMinutes,
                    )}
                  </p>
                  <p class="text-dim text-xs">
                    {formatDate(
                      session.occurredAt,
                    )}{#if session.startPage !== null}
                      · {session.startPage}–{session.endPage}{/if}
                  </p>
                </div>
                <button
                  type="button"
                  class="text-dim hover:text-fg rounded p-1"
                  aria-label={m.session_edit()}
                  onclick={() => beginEdit(session)}
                  ><Icon name="edit" class="h-4 w-4" /></button>
                <button
                  type="button"
                  class="text-dim hover:text-danger rounded p-1"
                  aria-label={m.session_delete()}
                  onclick={() => (deletingId = session.id)}
                  ><Icon name="trash" class="h-4 w-4" /></button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      {#if page > 1 || summary.hasMore}
        <div class="mt-2 flex justify-between gap-2">
          <button
            type="button"
            class="btn-text text-xs"
            disabled={page === 1}
            onclick={() => page--}>← {m.session_previous()}</button>
          <button
            type="button"
            class="btn-text text-xs"
            disabled={!summary.hasMore}
            onclick={() => page++}>{m.session_next()} →</button>
        </div>
      {/if}
    {:else if !sessionsQuery.loading}
      <p class="text-dim mt-2 text-xs">{m.session_history_empty()}</p>
    {/if}
  </div>
</section>

{#if deletingId}
  <ConfirmationModal
    title={m.session_delete_title()}
    message={m.session_delete_message()}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteMut.loading}
    onConfirm={() => deleteMut.mutate(deletingId!)}
    onCancel={() => (deletingId = null)} />
{/if}

<style>
  .bookmark-track {
    position: absolute;
    inset: 0.7rem 0.45rem 0.7rem auto;
    width: 0.55rem;
    border-radius: 999px 999px 0 0;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%);
  }

  .bookmark-fill {
    position: absolute;
    inset: auto 0 0;
    transition: height 300ms ease-out;
  }

  .total-pulse {
    animation: total-pulse 620ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes total-pulse {
    35% {
      color: var(--accent);
      transform: translateY(-2px) scale(1.06);
    }
  }
</style>
