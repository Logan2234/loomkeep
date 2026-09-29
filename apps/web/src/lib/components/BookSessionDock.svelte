<script lang="ts">
  import {
    createBookSession,
    deleteBookSession,
    getBookSessions,
    updateBookSession,
  } from "$lib/api/books";
  import { finishSessionTimer } from "$lib/api/session-timer";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { formatDate } from "$lib/format";
  import { isFeatureNew } from "$lib/feature-badges";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    formatSessionMinutes,
    localDateInput,
    MAX_SESSION_DURATION_MINUTES,
    sessionDateToIso,
  } from "$lib/session-presentation";
  import { toast } from "$lib/toast.svelte";
  import type {
    BookEntryDto,
    BookSessionDto,
    BookSessionMutationDto,
    CreateBookSessionDto,
    FinishSessionTimerDto,
    UpdateBookSessionDto,
  } from "@loomkeep/shared";
  import type { QueryKey } from "@tanstack/svelte-query";
  import { fly } from "svelte/transition";
  import Banner from "./Banner.svelte";
  import AnimatedNumberInput from "./AnimatedNumberInput.svelte";
  import ConfirmationModal from "./ConfirmationModal.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import NewBadge from "./NewBadge.svelte";
  import PageNumberControl from "./PageNumberControl.svelte";
  import ProgressBar from "./ProgressBar.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import SessionDurationPicker from "./SessionDurationPicker.svelte";
  import SessionTimerControl from "./SessionTimerControl.svelte";
  import SessionWeekChart from "./SessionWeekChart.svelte";
  import Switch from "./Switch.svelte";

  let {
    entry,
    detailKey,
  }: {
    entry: BookEntryDto;
    detailKey: QueryKey;
  } = $props();

  type PageMode = "quantity" | "range";

  const pageModeOptions = $derived([
    { value: "quantity" as const, label: m.book_session_mode_quantity() },
    { value: "range" as const, label: m.book_session_mode_range() },
  ]);

  const quickDurations = [15, 30, 45, 60] as const;
  const today = localDateInput();
  const reduced = prefersReducedMotion();
  let durationMinutes = $state(30);
  let occurredOn = $state(today);
  let notes = $state("");
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
  let editNotes = $state("");
  let editMode = $state<PageMode>("quantity");
  let editPagesRead = $state(0);
  let editStartPage = $state(0);
  let editEndPage = $state(1);
  let deletingId = $state<string | null>(null);
  let initializedEntryId = $state<string | null>(null);
  let finishingTimer = $state(false);
  let resumeTracking = $state(true);

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
      notes = "";
      showAdd = false;
    },
    successToast: m.session_saved(),
    errorToast: true,
  }));

  const finishTimerMut = createApiMutation<FinishSessionTimerDto, void>(() => ({
    mutate: finishSessionTimer,
    invalidates: [
      keys.sessionTimer.current(),
      keys.books.sessionsRoot(entry.id),
      detailKey,
      keys.stats.books(),
      keys.stats.social(),
      keys.gamification.progression(),
      keys.feed.all(),
    ],
    onSuccess: () => {
      page = 1;
      notes = "";
      finishingTimer = false;
      showAdd = false;
    },
    successToast: m.session_timer_saved(),
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

  const restoreMut = createApiMutation<
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
    onSuccess: () => (page = 1),
    successToast: m.session_restored(),
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
    onSuccess: (_, deletedId) => {
      const deleted = summary?.items.find(
        (session) => session.id === deletedId,
      );
      deletingId = null;
      page = 1;
      if (deleted) {
        toast.action(
          m.session_deleted(),
          {
            label: m.common_undo(),
            onSelect: () =>
              restoreMut.mutate({
                durationMinutes: deleted.durationMinutes,
                occurredAt: deleted.occurredAt,
                notes: deleted.notes,
                ...(deleted.startPage === null
                  ? { pagesRead: deleted.pagesRead }
                  : {
                      startPage: deleted.startPage,
                      endPage: deleted.endPage!,
                    }),
              }),
          },
          "success",
        );
      }
    },
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
    if (finishingTimer) {
      finishTimerMut.mutate({
        notes: notes || null,
        resumeTracking:
          (entry.status === "DROPPED" || entry.status === "READ") &&
          resumeTracking,
        ...pageData,
      });
      return;
    }
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
      notes: notes || null,
      resumeTracking:
        (entry.status === "DROPPED" || entry.status === "READ") &&
        resumeTracking,
      ...pageData,
    });
  }

  function openAdd() {
    finishingTimer = false;
    resumeTracking = true;
    showAdd = true;
  }

  function finishTimedSession(elapsedSeconds: number) {
    durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    notes = "";
    resumeTracking = true;
    finishingTimer = true;
    showAdd = true;
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
    editNotes = session.notes ?? "";
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
        notes: editNotes || null,
        ...pageData,
      },
    });
  }
</script>

<section class="space-y-3" aria-labelledby="book-session-title">
  <div class="border-border bg-bg/45 rounded-xl border p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h3 id="book-session-title" class="font-display font-bold">
            {m.session_week()}
          </h3>
          {#if isFeatureNew("sessions")}<NewBadge />{/if}
        </div>
        <p class="text-dim mt-1 text-sm tabular-nums">
          {weeklySummary(summary?.weekSessions ?? 0, summary?.weekMinutes ?? 0)}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary shrink-0"
        disabled={!referencePages}
        onclick={openAdd}>
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
        {#each Array(7) as _, i (i)}
          <span class="bg-surface-2 h-2 rounded-t-md"></span>
        {/each}
      </div>
    {/if}
  </div>

  <SessionTimerControl
    domain="BOOKS"
    entryId={entry.id}
    disabled={!referencePages}
    onFinish={finishTimedSession} />

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
</section>

{#if showAdd}
  <Modal
    title={m.book_session_add_title()}
    onclose={() => {
      showAdd = false;
      finishingTimer = false;
    }}>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}>
      <SegmentedControl
        options={pageModeOptions}
        value={mode}
        onChange={(next) => (mode = next)}
        label={m.book_session_pages()}
        class="w-full [&>button]:flex-1 [&>button]:justify-center" />

      {#if entry.status === "DROPPED" || entry.status === "READ"}
        <div
          class="border-border bg-bg/55 mt-3 flex items-center justify-between gap-4 rounded-xl border p-3.5">
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              {entry.status === "READ"
                ? m.session_resume_completed()
                : m.session_resume_tracking()}
            </p>
            <p class="text-dim mt-0.5 text-xs leading-relaxed">
              {entry.status === "READ"
                ? m.session_resume_completed_help()
                : m.session_resume_tracking_help()}
            </p>
          </div>
          <Switch
            checked={resumeTracking}
            onChange={(checked) => (resumeTracking = checked)}
            label={entry.status === "READ"
              ? m.session_resume_completed()
              : m.session_resume_tracking()} />
        </div>
      {/if}

      <div
        class="border-accent/35 from-accent/14 to-accent/3 mt-3 rounded-2xl border bg-linear-to-br p-4 sm:p-5">
        {#if mode === "quantity"}
          <PageNumberControl
            bind:value={pagesRead}
            label={m.book_session_pages()}
            min={1}
            max={referencePages ?? undefined}
            disabled={createMut.loading} />
        {:else}
          <div
            class="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
            <PageNumberControl
              bind:value={startPage}
              label={m.book_session_start_page()}
              min={0}
              max={referencePages ?? undefined}
              disabled={createMut.loading}
              compact />
            <span
              class="text-dim rotate-90 justify-self-center text-xl sm:mb-4 sm:rotate-0"
              aria-hidden="true">→</span>
            <PageNumberControl
              bind:value={endPage}
              label={m.book_session_end_page()}
              min={1}
              max={referencePages ?? undefined}
              disabled={createMut.loading}
              compact />
          </div>
        {/if}
      </div>

      <div class="mt-3">
        <SessionDurationPicker
          bind:value={durationMinutes}
          {quickDurations}
          disabled={createMut.loading ||
            finishTimerMut.loading ||
            finishingTimer}
          variant="neutral" />
      </div>

      <label
        class="mt-3 flex flex-col gap-1.5 text-xs font-semibold {finishingTimer
          ? 'hidden'
          : ''}">
        {m.session_date()}
        <span class="relative">
          <Icon
            name="calendar"
            class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            class="input w-full pl-10"
            type="date"
            max={today}
            bind:value={occurredOn}
            disabled={createMut.loading || finishTimerMut.loading} />
        </span>
      </label>

      <label class="mt-4 flex flex-col gap-1.5 text-xs font-semibold">
        <span>
          {m.session_notes()}
          <span class="text-dim font-normal">{m.common_optional_marker()}</span>
        </span>
        <span class="relative">
          <textarea
            class="input min-h-28 w-full resize-y pb-7 leading-relaxed"
            maxlength="1000"
            placeholder={m.book_session_notes_placeholder()}
            bind:value={notes}
            disabled={createMut.loading || finishTimerMut.loading}></textarea>
          <span
            class="text-dim pointer-events-none absolute right-3 bottom-2 text-[0.65rem] tabular-nums">
            {notes.length} / 1000
          </span>
        </span>
      </label>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={createMut.loading || finishTimerMut.loading}
          onclick={() => {
            showAdd = false;
            finishingTimer = false;
          }}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={!referencePages ||
            createMut.loading ||
            finishTimerMut.loading ||
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
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div class="border-border bg-surface rounded-xl border p-3">
          <p
            class="timecode text-dim text-[0.58rem] tracking-[0.14em] uppercase">
            {m.session_total()}
          </p>
          <p class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(summary.totalTrackedMinutes)}
          </p>
        </div>
        <div class="border-border bg-surface rounded-xl border p-3">
          <p
            class="timecode text-dim text-[0.58rem] tracking-[0.14em] uppercase">
            {m.book_session_pages()}
          </p>
          <p class="font-display mt-1 text-lg font-bold tabular-nums">
            {summary.totalPagesRead}
          </p>
        </div>
        <div
          class="border-border bg-surface col-span-2 rounded-xl border p-3 sm:col-span-1">
          <p
            class="timecode text-dim text-[0.58rem] tracking-[0.14em] uppercase">
            {m.session_month()}
          </p>
          <p class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(summary.monthMinutes)}
          </p>
        </div>
      </div>

      <ol class="mt-4 flex flex-col gap-3">
        {#each summary.items as session, index (session.id)}
          <li
            in:fly|global={{
              y: reduced ? 0 : 8,
              duration: reduced ? 0 : 220,
              delay: reduced ? 0 : Math.min(index * 35, 175),
            }}
            class="border-border bg-surface group hover:border-accent/35 rounded-xl border p-3.5 transition-colors">
            {#if editingId === session.id}
              <div class="grid gap-2 sm:grid-cols-2">
                <AnimatedNumberInput
                  bind:value={editDuration}
                  label={m.session_duration()}
                  min={1}
                  max={MAX_SESSION_DURATION_MINUTES}
                  class="border-border bg-bg h-10 w-full"
                  numberClass="text-sm" />
                <input
                  class="input"
                  type="date"
                  max={today}
                  bind:value={editDate}
                  aria-label={m.session_date()} />
              </div>
              <SegmentedControl
                options={pageModeOptions}
                value={editMode}
                onChange={(next) => (editMode = next)}
                label={m.book_session_pages()}
                class="mt-2 w-full [&>button]:flex-1 [&>button]:justify-center" />
              {#if editMode === "quantity"}
                <AnimatedNumberInput
                  bind:value={editPagesRead}
                  label={m.book_session_pages()}
                  min={1}
                  max={referencePages ?? undefined}
                  class="border-border bg-bg mt-2 h-10 w-full"
                  numberClass="text-sm" />
              {:else}
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <AnimatedNumberInput
                    bind:value={editStartPage}
                    label={m.book_session_start_page()}
                    min={0}
                    max={referencePages ?? undefined}
                    class="border-border bg-bg h-10 w-full min-w-0"
                    numberClass="text-sm" />
                  <AnimatedNumberInput
                    bind:value={editEndPage}
                    label={m.book_session_end_page()}
                    min={1}
                    max={referencePages ?? undefined}
                    class="border-border bg-bg h-10 w-full min-w-0"
                    numberClass="text-sm" />
                </div>
              {/if}
              <label class="mt-2 block">
                <span class="sr-only">{m.session_notes()}</span>
                <textarea
                  class="input min-h-24 w-full resize-y"
                  maxlength="1000"
                  placeholder={m.book_session_notes_placeholder()}
                  bind:value={editNotes}></textarea>
              </label>
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
              <div class="flex items-start gap-3">
                <div
                  class="bg-accent/12 text-accent mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                  <Icon name="book" class="h-4 w-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-display text-base font-bold">
                        {session.pagesRead}
                        {m.book_session_pages().toLocaleLowerCase()}
                        <span class="text-dim font-normal">·</span>
                        <span class="tabular-nums">
                          {formatSessionMinutes(session.durationMinutes)}
                        </span>
                      </p>
                      <p
                        class="text-dim mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <Icon name="calendar" class="h-3.5 w-3.5" />
                        {formatDate(session.occurredAt)}
                        {#if session.startPage !== null}
                          <span aria-hidden="true">·</span>
                          <span>{session.startPage}–{session.endPage}</span>
                        {/if}
                      </p>
                    </div>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="text-dim hover:bg-bg hover:text-fg rounded-lg p-1.5 transition-colors"
                        aria-label={m.session_edit()}
                        onclick={() => beginEdit(session)}>
                        <Icon name="edit" class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        class="text-dim hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 transition-colors"
                        aria-label={m.session_delete()}
                        onclick={() => (deletingId = session.id)}>
                        <Icon name="trash" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {#if session.notes}
                    <p
                      class="border-border text-dim mt-3 border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-line">
                      {session.notes}
                    </p>
                  {/if}
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
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
