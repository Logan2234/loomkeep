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
  import Modal from "./Modal.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import SessionWeekChart from "./SessionWeekChart.svelte";

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
  let showAdd = $state(false);
  let showHistory = $state(false);
  let editingId = $state<string | null>(null);
  let editDuration = $state(0);
  let editDate = $state(today);
  let editMode = $state<PageMode>("quantity");
  let editPagesRead = $state(0);
  let editStartPage = $state(0);
  let editEndPage = $state(1);
  let deletingId = $state<string | null>(null);
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
  const totalSessions = $derived(summary?.totalSessions ?? 0);

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
    onSuccess: () => {
      page = 1;
      showAdd = false;
    },
    successToast: m.session_saved(),
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
    onSuccess: () => (editingId = null),
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
      page = 1;
    },
    successToast: m.session_deleted(),
    errorToast: true,
  }));

  function weeklySummary(count: number, minutes: number): string {
    const duration = formatSessionMinutes(minutes);
    return count === 1
      ? m.session_week_summary_one({ duration })
      : m.session_week_summary_many({ count, duration });
  }

  function historyLabel(count: number): string {
    return count === 1 ? m.session_view_one() : m.session_view_many({ count });
  }

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

  function openHistory() {
    page = 1;
    editingId = null;
    showHistory = true;
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

<section class="space-y-3" aria-labelledby="book-session-title">
  <div class="border-border bg-bg/45 rounded-xl border p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h3 id="book-session-title" class="font-display font-bold">
          {m.session_week()}
        </h3>
        <p class="text-dim mt-1 text-sm tabular-nums">
          {weeklySummary(summary?.weekSessions ?? 0, summary?.weekMinutes ?? 0)}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary shrink-0"
        disabled={!referencePages}
        onclick={() => (showAdd = true)}>
        <Icon name="plus" class="h-4 w-4" />
        {m.book_session_add_short()}
      </button>
    </div>

    {#if sessionsQuery.error}
      <div class="mt-4">
        <Banner variant="error">{sessionsQuery.error}</Banner>
      </div>
    {:else if summary}
      <SessionWeekChart days={summary.weekDays} />
    {:else}
      <div
        class="mt-4 grid h-20 grid-cols-7 items-end gap-2"
        aria-hidden="true">
        {#each Array(7) as i (i)}
          <span class="bg-surface-2 h-2 rounded-t-md"></span>
        {/each}
      </div>
    {/if}
  </div>

  {#if !referencePages}
    <Banner variant="info">{m.book_session_reference_missing()}</Banner>
  {/if}

  <button
    type="button"
    class="border-border hover:border-accent/60 hover:text-accent font-display w-full rounded-xl border px-4 py-3 font-bold transition-colors disabled:cursor-default disabled:opacity-50"
    disabled={totalSessions === 0}
    onclick={openHistory}>
    {historyLabel(totalSessions)}
  </button>

  <div class="border-border bg-bg/45 rounded-xl border p-3.5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h4 class="font-display font-bold">{m.book_session_progress()}</h4>
        {#if referencePages}
          <p class="text-dim mt-1 text-xs">
            {m.book_session_reference({ count: referencePages })}
          </p>
        {/if}
      </div>
      <p class="font-display text-xl font-extrabold tabular-nums">
        {progressPct} %
      </p>
    </div>

    {#if referencePages}
      <div class="mt-3">
        <div class="text-dim mb-1 flex justify-between text-xs tabular-nums">
          <span>{entry.currentPage} / {referencePages}</span>
          <span>
            {summary?.totalPagesRead ?? 0}
            {m.book_session_pages().toLocaleLowerCase()}
          </span>
        </div>
        <ProgressBar
          value={progressPct}
          label={m.book_session_progress()}
          height="h-2" />
      </div>
    {/if}

    {#if summary}
      <dl class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div class="bg-surface rounded-lg p-2.5">
          <dt class="text-dim text-[0.68rem]">{m.session_total()}</dt>
          <dd class="font-display mt-0.5 font-bold tabular-nums">
            {formatSessionMinutes(summary.totalTrackedMinutes)}
          </dd>
        </div>
        <div class="bg-surface rounded-lg p-2.5">
          <dt class="text-dim text-[0.68rem]">{m.session_month()}</dt>
          <dd class="font-display mt-0.5 font-bold tabular-nums">
            {formatSessionMinutes(summary.monthMinutes)}
          </dd>
        </div>
        <div class="bg-surface col-span-2 rounded-lg p-2.5 sm:col-span-1">
          <dt class="text-dim text-[0.68rem]">{m.book_session_pace()}</dt>
          <dd class="font-display mt-0.5 text-sm font-bold">
            {summary.averagePagesPerDay === null
              ? m.book_session_pace_pending()
              : m.book_session_pace_value({
                  count: summary.averagePagesPerDay,
                })}
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
  </div>

  {#if summary?.completionSuggested && entry.status !== "READ"}
    <div class="border-accent/40 bg-accent/8 rounded-lg border p-3">
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
</section>

{#if showAdd}
  <Modal title={m.book_session_add_title()} onclose={() => (showAdd = false)}>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}>
      <div class="bg-surface grid grid-cols-2 gap-1 rounded-lg p-1">
        <button
          type="button"
          class="rounded-md px-2 py-1.5 text-xs font-semibold transition-colors {mode ===
          'quantity'
            ? 'bg-bg text-fg shadow-sm'
            : 'text-dim'}"
          aria-pressed={mode === "quantity"}
          onclick={() => (mode = "quantity")}>
          {m.book_session_mode_quantity()}
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-1.5 text-xs font-semibold transition-colors {mode ===
          'range'
            ? 'bg-bg text-fg shadow-sm'
            : 'text-dim'}"
          aria-pressed={mode === "range"}
          onclick={() => (mode = "range")}>
          {m.book_session_mode_range()}
        </button>
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
              disabled={createMut.loading} />
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
                disabled={createMut.loading} />
            </label>
            <label class="flex flex-col gap-1.5 text-xs font-semibold">
              {m.book_session_end_page()}
              <input
                class="input min-w-0"
                type="number"
                min="1"
                max={referencePages ?? undefined}
                bind:value={endPage}
                disabled={createMut.loading} />
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
              disabled={createMut.loading} />
            <span class="text-dim">{m.session_minutes_short()}</span>
          </span>
        </label>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        {#each quickDurations as minutes (minutes)}
          <button
            type="button"
            class="rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors {durationMinutes ===
            minutes
              ? 'border-accent bg-accent/12 text-accent'
              : 'border-border text-dim hover:text-fg'}"
            aria-pressed={durationMinutes === minutes}
            onclick={() => (durationMinutes = minutes)}>
            {formatSessionMinutes(minutes)}
          </button>
        {/each}
      </div>

      <label class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
        {m.session_date()}
        <input
          class="input w-full"
          type="date"
          max={today}
          bind:value={occurredOn}
          disabled={createMut.loading} />
      </label>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={createMut.loading}
          onclick={() => (showAdd = false)}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={!referencePages ||
            createMut.loading ||
            durationMinutes < 1 ||
            !occurredOn ||
            (mode === "quantity"
              ? pagesRead < 1
              : startPage < 0 || endPage <= startPage)}>
          {m.session_save()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if showHistory}
  <Modal
    title={historyLabel(totalSessions)}
    wide
    onclose={() => (showHistory = false)}>
    {#if sessionsQuery.error}
      <Banner variant="error">{sessionsQuery.error}</Banner>
    {:else if summary?.items.length}
      <ul class="flex flex-col gap-2">
        {#each summary.items as session (session.id)}
          <li class="bg-surface rounded-lg p-3">
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
                  onclick={() => (editMode = "quantity")}>
                  {m.book_session_mode_quantity()}
                </button>
                <button
                  type="button"
                  class="rounded-md px-2 py-1 text-xs {editMode === 'range'
                    ? 'bg-surface font-semibold'
                    : 'text-dim'}"
                  onclick={() => (editMode = "range")}>
                  {m.book_session_mode_range()}
                </button>
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
                  onclick={() => (editingId = null)}>
                  {m.common_cancel()}
                </button>
                <button
                  type="button"
                  class="btn btn-primary text-xs"
                  disabled={updateMut.loading}
                  onclick={() => saveEdit(session.id)}>
                  {m.common_save()}
                </button>
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
                  onclick={() => beginEdit(session)}>
                  <Icon name="edit" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="text-dim hover:text-danger rounded p-1"
                  aria-label={m.session_delete()}
                  onclick={() => (deletingId = session.id)}>
                  <Icon name="trash" class="h-4 w-4" />
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      {#if page > 1 || summary.hasMore}
        <div class="mt-3 flex justify-between gap-2">
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
      <p class="text-dim text-sm">{m.session_history_empty()}</p>
    {/if}
  </Modal>
{/if}

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
