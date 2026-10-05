<script lang="ts">
  import {
    SESSION_NOTES_MAX_LENGTH,
    MAX_SESSION_DURATION_MINUTES,
  } from "@loomkeep/shared";

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
  import TrackingStatusBadge from "./TrackingStatusBadge.svelte";

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
  let historyDirection = $state(1);
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
  let linkToReading = $state(true);
  let restartDropped = $state(false);

  $effect(() => {
    if (initializedEntryId === entry.id) return;
    initializedEntryId = entry.id;
    startPage = Math.max(0, entry.currentPage);
    endPage = Math.max(1, entry.currentPage + 10);
  });

  const referencePages = $derived(entry.referencePageCount);
  const sessionKey = $derived(keys.books.sessions(entry.id, page));
  const sessionsQuery = createApiQuery(() => ({
    key: sessionKey,
    fetch: () => getBookSessions(entry.id, page),
  }));
  const summary = $derived(sessionsQuery.data);
  const totalSessions = $derived(summary?.totalSessions ?? 0);
  const activeReading = $derived(summary?.activeReading ?? null);
  const completedReadings = $derived(
    entry.readings.filter((reading) => reading.status === "COMPLETED"),
  );
  const lastFinishedReading = $derived(
    entry.readings.find((reading) => reading.status !== "ACTIVE") ?? null,
  );
  const displayedReading = $derived(
    activeReading ??
      entry.readings.find((reading) => reading.status === "ACTIVE") ??
      lastFinishedReading,
  );
  const displayedReadingIsActive = $derived(
    displayedReading?.status === "ACTIVE",
  );
  const displayedReferencePages = $derived(
    displayedReading?.referencePageCount ?? referencePages,
  );
  const displayedCurrentPage = $derived(
    displayedReading?.currentPage ?? entry.currentPage,
  );
  const progressPct = $derived(
    displayedReferencePages
      ? Math.min(
          100,
          Math.round((displayedCurrentPage / displayedReferencePages) * 100),
        )
      : 0,
  );
  const remainingPages = $derived(
    displayedReferencePages
      ? Math.max(0, displayedReferencePages - displayedCurrentPage)
      : null,
  );
  const historyGroups = $derived.by(() => {
    const groups: {
      key: string;
      label: string;
      sessions: BookSessionDto[];
      totalMinutes: number;
    }[] = [];
    const groupsByKey = new Map<string, (typeof groups)[number]>();
    for (const session of summary?.items ?? []) {
      const key = String(session.readingNumber ?? "standalone");
      const existing = groupsByKey.get(key);
      if (!existing) {
        const group = {
          key,
          label: historyGroupLabel(session),
          sessions: [session],
          totalMinutes: session.durationMinutes,
        };
        groups.push(group);
        groupsByKey.set(key, group);
      } else {
        existing.sessions.push(session);
        existing.totalMinutes += session.durationMinutes;
      }
    }
    return groups;
  });

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

  function historyDescription(count: number): string {
    return count === 1
      ? m.book_session_history_grouped_one()
      : m.book_session_history_grouped_many({ count });
  }

  function historyItemTitle(session: BookSessionDto): string {
    if (session.readingNumber === null) {
      return m.book_session_history_standalone({ count: session.pagesRead });
    }
    return session.startPage === null
      ? m.book_session_history_quantity({
          count: session.pagesRead,
        })
      : m.book_session_history_range({
          start: session.startPage,
          end: session.endPage!,
        });
  }

  function historyGroupLabel(session: BookSessionDto): string {
    return session.readingNumber === null
      ? m.session_cycle_standalone()
      : m.book_cycle_current({ number: session.readingNumber });
  }

  function submit() {
    if (!referencePages || durationMinutes < 1) return;
    const cycleAction = !linkToReading
      ? ("HISTORY_ONLY" as const)
      : entry.status === "READ" || restartDropped
        ? ("RESTART" as const)
        : entry.status === "DROPPED"
          ? ("CONTINUE" as const)
          : undefined;
    const pageData =
      mode === "quantity" ? { pagesRead } : { startPage, endPage };
    if (finishingTimer) {
      finishTimerMut.mutate({
        notes: notes || null,
        cycleAction,
        ...pageData,
      });
      return;
    }
    createMut.mutate({
      durationMinutes,
      occurredAt: sessionDateToIso(occurredOn),
      notes: notes || null,
      cycleAction,
      ...pageData,
    });
  }

  function openAdd() {
    finishingTimer = false;
    linkToReading = true;
    restartDropped = false;
    showAdd = true;
  }

  function finishTimedSession(elapsedSeconds: number) {
    durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
    notes = "";
    linkToReading = true;
    restartDropped = false;
    finishingTimer = true;
    showAdd = true;
  }

  function openHistory() {
    page = 1;
    historyDirection = 1;
    editingId = null;
    showHistory = true;
  }

  function changeHistoryPage(nextPage: number) {
    historyDirection = nextPage > page ? 1 : -1;
    editingId = null;
    page = nextPage;
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

<section aria-labelledby="book-session-title">
  <article class="border-border bg-bg/45 overflow-hidden rounded-2xl border">
    <div class="p-4 sm:p-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-dim text-sm">
            {displayedReadingIsActive
              ? m.book_cycle_current_label()
              : m.book_cycle_last_label()}
          </p>
          <h3
            id="book-session-title"
            class="font-display mt-0.5 text-xl font-bold">
            {m.book_cycle_current({ number: displayedReading?.number ?? 1 })}
          </h3>
          {#if displayedReading?.startedAt}
            <p class="text-dim mt-1 text-xs">
              {m.session_cycle_started({
                date: formatDate(displayedReading.startedAt),
              })}
            </p>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if isFeatureNew("sessions")}<NewBadge />{/if}
          <TrackingStatusBadge domain="BOOKS" status={entry.status} />
        </div>
      </header>

      <div
        class="mt-5 grid gap-6 lg:grid-cols-[minmax(13rem,0.85fr)_minmax(20rem,1.15fr)] lg:items-end">
        <div>
          <p
            class="font-display text-4xl leading-none font-extrabold tabular-nums sm:text-5xl">
            {m.book_session_page_value({ number: displayedCurrentPage })}
          </p>
          {#if displayedReferencePages}
            <p class="text-dim mt-2 text-sm tabular-nums">
              {m.book_cycle_page_context({
                count: displayedReferencePages,
                progress: progressPct,
              })}
            </p>
            {#if remainingPages !== null}
              <p class="text-dim mt-4 text-right text-xs tabular-nums">
                {m.book_cycle_remaining({ count: remainingPages })}
              </p>
            {/if}
            <ProgressBar
              value={progressPct}
              label={m.book_session_progress()}
              height="h-2.5"
              fillClass="bg-accent"
              endCap="bookmark"
              class="mt-2" />
          {/if}
        </div>

        <div>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h4 class="font-display font-bold">{m.common_this_week()}</h4>
            <p class="text-dim text-xs tabular-nums">
              {weeklySummary(
                summary?.weekSessions ?? 0,
                summary?.weekMinutes ?? 0,
              )}
            </p>
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
      </div>

      <dl class="border-border mt-5 grid grid-cols-1 border-y sm:grid-cols-3">
        <div class="border-border px-1 py-3 sm:border-r sm:px-4">
          <dt class="text-dim text-xs">{m.book_cycle_time()}</dt>
          <dd class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(displayedReading?.trackedMinutes ?? 0)}
          </dd>
        </div>
        <div
          class="border-border border-t px-1 py-3 sm:border-t-0 sm:border-r sm:px-4">
          <dt class="text-dim text-xs">{m.book_session_total_time()}</dt>
          <dd class="font-display mt-1 text-lg font-bold tabular-nums">
            {formatSessionMinutes(
              summary?.totalTrackedMinutes ?? entry.trackedReadingMinutes,
            )}
          </dd>
        </div>
        <div class="border-border border-t px-1 py-3 sm:border-t-0 sm:px-4">
          <dt class="text-dim text-xs">{m.book_session_pace()}</dt>
          <dd class="font-display mt-1 text-lg font-bold">
            {summary?.averagePagesPerDay === null ||
            summary?.averagePagesPerDay === undefined
              ? m.book_session_pace_pending()
              : m.book_session_pace_value({
                  count: summary.averagePagesPerDay,
                })}
          </dd>
        </div>
      </dl>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!referencePages}
            onclick={openAdd}>
            <Icon name="plus" class="h-4 w-4" />
            {m.book_session_add_short()}
          </button>
          <SessionTimerControl
            domain="BOOKS"
            entryId={entry.id}
            disabled={!referencePages}
            compact
            onFinish={finishTimedSession} />
        </div>
        {#if summary?.estimatedCompletionDate}
          <p class="text-dim text-xs">
            {m.book_session_eta({
              date: formatDate(`${summary.estimatedCompletionDate}T12:00:00`),
            })}
          </p>
        {/if}
      </div>
    </div>

    <footer
      class="border-border bg-surface/55 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
      {#if completedReadings.length > 0}
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="bg-success/12 text-success grid h-9 w-9 shrink-0 place-items-center rounded-full">
            <Icon name="check" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              {completedReadings.length === 1
                ? m.book_cycle_completed_one()
                : m.book_cycle_completed_many({
                    count: completedReadings.length,
                  })}
            </p>
            <p class="text-dim truncate text-xs">
              {m.book_cycle_completed_detail({
                number: completedReadings[0]!.number,
                count:
                  completedReadings[0]!.referencePageCount ??
                  completedReadings[0]!.currentPage,
              })}
            </p>
          </div>
        </div>
      {:else if lastFinishedReading?.status === "DROPPED"}
        <p class="text-dim text-xs">
          {m.book_cycle_current({ number: lastFinishedReading.number })} ·
          {m.session_cycle_dropped()}
        </p>
      {/if}
      <button
        type="button"
        class="text-dim hover:text-accent ml-auto text-sm font-semibold underline decoration-current/40 underline-offset-4 transition-colors disabled:cursor-default disabled:opacity-50"
        disabled={totalSessions === 0}
        onclick={openHistory}>
        {historyLabel(totalSessions)}
      </button>
    </footer>
  </article>

  {#if !referencePages}
    <div class="mt-3">
      <Banner variant="info">{m.book_session_reference_missing()}</Banner>
    </div>
  {/if}
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
                ? m.session_cycle_restart_book()
                : restartDropped
                  ? m.session_cycle_restart_book()
                  : m.session_cycle_continue_book()}
            </p>
            <p class="text-dim mt-0.5 text-xs leading-relaxed">
              {linkToReading
                ? entry.status === "READ" || restartDropped
                  ? m.session_cycle_restart_book_help()
                  : m.session_cycle_continue_book_help()
                : m.session_cycle_history_only_book_help()}
            </p>
            {#if entry.status === "DROPPED" && linkToReading}
              <button
                type="button"
                class="link-accent mt-2 text-xs"
                onclick={() => (restartDropped = !restartDropped)}>
                {restartDropped
                  ? m.session_cycle_continue_instead()
                  : m.session_cycle_restart_instead()}
              </button>
            {/if}
          </div>
          <Switch
            checked={linkToReading}
            onChange={(checked) => (linkToReading = checked)}
            label={entry.status === "READ"
              ? m.session_cycle_restart_book()
              : m.session_cycle_continue_book()} />
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
            maxlength={SESSION_NOTES_MAX_LENGTH}
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
    title={m.book_session_history_title()}
    description={historyDescription(totalSessions)}
    wide
    onclose={() => (showHistory = false)}>
    {#if sessionsQuery.error}
      <Banner variant="error">{sessionsQuery.error}</Banner>
    {:else if summary?.items.length}
      {#key page}
        <div
          in:fly|global={{
            x: reduced ? 0 : historyDirection * 28,
            duration: reduced ? 0 : 220,
          }}
          out:fly|global={{
            x: reduced ? 0 : historyDirection * -28,
            duration: reduced ? 0 : 180,
          }}
          class="space-y-3">
          {#each historyGroups as group, groupIndex (group.key)}
            <section
              in:fly|global={{
                y: reduced ? 0 : 10,
                duration: reduced ? 0 : 220,
                delay: reduced ? 0 : Math.min(groupIndex * 55, 165),
              }}
              class="border-border bg-bg/35 overflow-hidden rounded-xl border">
              <header
                class="border-border bg-surface/70 flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <div class="flex items-center gap-2.5">
                  <span
                    class="bg-accent h-5 w-1 rounded-full"
                    aria-hidden="true"></span>
                  <h4 class="text-sm font-bold">{group.label}</h4>
                </div>
                <p class="text-dim text-xs tabular-nums">
                  {weeklySummary(group.sessions.length, group.totalMinutes)}
                </p>
              </header>
              <ol
                class="before:bg-border relative before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px">
                {#each group.sessions as session (session.id)}
                  <li
                    class="border-border group relative border-b py-4 pr-3 pl-10 last:border-b-0 sm:pr-4">
                    <span
                      class="bg-accent ring-bg absolute top-[1.35rem] left-4 h-2.5 w-2.5 rounded-full ring-4"
                      aria-hidden="true"></span>
                    {#if editingId === session.id}
                      <div
                        class="border-border bg-surface/60 min-w-0 rounded-xl border p-3">
                        <div class="grid gap-3 sm:grid-cols-2">
                          <label
                            class="flex flex-col gap-1.5 text-xs font-semibold">
                            <span>{m.session_duration()}</span>
                            <span class="relative">
                              <AnimatedNumberInput
                                bind:value={editDuration}
                                label={m.session_duration()}
                                min={1}
                                max={MAX_SESSION_DURATION_MINUTES}
                                class="border-border bg-bg h-11 w-full"
                                numberClass="text-base" />
                              <span
                                class="text-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold">
                                {m.common_minutes_short()}
                              </span>
                            </span>
                          </label>
                          <label
                            class="flex flex-col gap-1.5 text-xs font-semibold">
                            <span>{m.session_date()}</span>
                            <input
                              class="input"
                              type="date"
                              max={today}
                              bind:value={editDate} />
                          </label>
                        </div>
                        <SegmentedControl
                          options={pageModeOptions}
                          value={editMode}
                          onChange={(next) => (editMode = next)}
                          label={m.book_session_pages()}
                          class="mt-3 w-full [&>button]:flex-1 [&>button]:justify-center" />
                        {#if editMode === "quantity"}
                          <label
                            class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
                            <span>{m.book_session_pages()}</span>
                            <AnimatedNumberInput
                              bind:value={editPagesRead}
                              label={m.book_session_pages()}
                              min={1}
                              max={referencePages ?? undefined}
                              class="border-border bg-bg h-11 w-full"
                              numberClass="text-base" />
                          </label>
                        {:else}
                          <div class="mt-3 grid grid-cols-2 gap-3">
                            <label
                              class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">
                              <span>{m.book_session_start_page()}</span>
                              <AnimatedNumberInput
                                bind:value={editStartPage}
                                label={m.book_session_start_page()}
                                min={0}
                                max={referencePages ?? undefined}
                                class="border-border bg-bg h-11 w-full min-w-0"
                                numberClass="text-base" />
                            </label>
                            <label
                              class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">
                              <span>{m.book_session_end_page()}</span>
                              <AnimatedNumberInput
                                bind:value={editEndPage}
                                label={m.book_session_end_page()}
                                min={1}
                                max={referencePages ?? undefined}
                                class="border-border bg-bg h-11 w-full min-w-0"
                                numberClass="text-base" />
                            </label>
                          </div>
                        {/if}
                        <label
                          class="mt-3 flex flex-col gap-1.5 text-xs font-semibold">
                          <span>
                            {m.session_notes()}
                            <span class="text-dim font-normal"
                              >{m.common_optional_marker()}</span>
                          </span>
                          <textarea
                            class="input min-h-24 w-full resize-y"
                            maxlength={SESSION_NOTES_MAX_LENGTH}
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
                      </div>
                    {:else}
                      <div
                        class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-x-5">
                        <time
                          class="text-dim col-span-2 mb-1 text-xs tabular-nums sm:col-span-1 sm:mb-0">
                          {formatDate(session.occurredAt)}
                        </time>
                        <div class="min-w-0">
                          <p class="text-sm font-semibold">
                            {historyItemTitle(session)}
                          </p>
                          {#if session.notes}
                            <p
                              class="text-dim mt-1 text-sm leading-relaxed whitespace-pre-line">
                              « {session.notes} »
                            </p>
                          {/if}
                        </div>
                        <div class="flex items-start gap-2">
                          <span
                            class="font-display pt-0.5 text-sm font-bold tabular-nums">
                            {formatSessionMinutes(session.durationMinutes)}
                          </span>
                          <div
                            class="flex opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              type="button"
                              class="text-dim hover:bg-surface-2 hover:text-fg rounded-lg p-1.5 transition-colors"
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
                      </div>
                    {/if}
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/key}
      {#if page > 1 || summary.hasMore}
        <div class="mt-3 flex justify-between gap-2">
          <button
            type="button"
            class="btn-text text-xs"
            disabled={page === 1}
            onclick={() => changeHistoryPage(page - 1)}
            >← {m.session_previous()}</button>
          <button
            type="button"
            class="btn-text text-xs"
            disabled={!summary.hasMore}
            onclick={() => changeHistoryPage(page + 1)}
            >{m.session_next()} →</button>
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
